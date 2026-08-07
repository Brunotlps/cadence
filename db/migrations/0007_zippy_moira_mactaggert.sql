-- Falha antes de qualquer DDL se houver dado anterior incompatível. Não corrige,
-- reclassifica ou apaga metas/aportes silenciosamente.
do $$
begin
  if exists (
    select 1
    from public.goals
    where not (
      btrim(name) <> ''
      and char_length(name) <= 100
      and target_amount > 0
      and target_amount <> 'NaN'::numeric
      and (
        suggested_monthly is null
        or (
          suggested_monthly > 0
          and suggested_monthly <> 'NaN'::numeric
        )
      )
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'existing goals violate stage 07 integrity constraints';
  end if;

  if exists (
    select 1
    from public.transactions
    where goal_id is not null
      and kind <> 'contribution'
  ) then
    raise exception using
      errcode = '23514',
      message = 'existing non-contribution transaction references a goal';
  end if;

  if exists (
    select 1
    from public.transactions t
    join public.goals g on g.id = t.goal_id
    where t.goal_id is not null
      and t.workspace_id <> g.workspace_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'existing contribution references a goal from another workspace';
  end if;
end;
$$;--> statement-breakpoint

-- `created_at` é timestamp sem timezone no schema histórico. Os valores existentes
-- foram gravados em UTC; converte esse instante para a data civil de São Paulo antes
-- de tornar a nova coluna obrigatória. Novas linhas usam o default e a trigger abaixo.
ALTER TABLE "goals" ADD COLUMN "started_on" date;--> statement-breakpoint
UPDATE "goals"
SET "started_on" = (("created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date;--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "started_on"
  SET DEFAULT (timezone('America/Sao_Paulo', now()))::date;--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "started_on" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "goals_workspace_created_idx" ON "goals" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_contribution_goal_idx" ON "transactions" USING btree ("workspace_id","goal_id","occurred_on" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "transactions"."kind" = 'contribution' and "transactions"."goal_id" is not null;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_name_check" CHECK (btrim("goals"."name") <> '' and char_length("goals"."name") <= 100);--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_target_amount_positive_check" CHECK ("goals"."target_amount" > 0 and "goals"."target_amount" <> 'NaN'::numeric);--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_suggested_monthly_positive_check" CHECK ("goals"."suggested_monthly" is null or (
        "goals"."suggested_monthly" > 0
        and "goals"."suggested_monthly" <> 'NaN'::numeric
      ));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_goal_kind_check" CHECK ("transactions"."goal_id" is null or "transactions"."kind" = 'contribution');--> statement-breakpoint

-- `started_on` é derivado no banco e não pode ser forjado no insert nem reescrito
-- depois. Nome, alvo e ritmo permanecem campos de negócio editáveis.
create function public.protect_goal_system_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.started_on := (timezone('America/Sao_Paulo', now()))::date;
  elsif TG_OP = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.started_on is distinct from old.started_on
       or new.created_at is distinct from old.created_at then
      raise exception using
        errcode = '23514',
        message = 'goal system fields are immutable';
    end if;
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.protect_goal_system_fields()
  from public, anon, authenticated;--> statement-breakpoint

create trigger protect_goal_system_fields
  before insert or update on public.goals
  for each row
  execute function public.protect_goal_system_fields();--> statement-breakpoint

-- IMPORTANTE: esta função e esta trigger cobrem somente INSERT. O FK existente
-- `transactions_goal_id_goals_id_fk` continua com ON DELETE SET NULL, que executa
-- UPDATE na transação. Não anexar esta trigger a UPDATE: a exclusão real da meta
-- precisa conseguir preservar o aporte órfão com goal_id = NULL.
create function public.validate_contribution_goal_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  referenced_goal_workspace_id uuid;
begin
  if TG_OP <> 'INSERT' or new.kind <> 'contribution' then
    return new;
  end if;

  if new.goal_id is null then
    raise exception using
      errcode = '23514',
      message = 'new contribution must reference a goal';
  end if;

  select workspace_id
  into referenced_goal_workspace_id
  from public.goals
  where id = new.goal_id;

  if referenced_goal_workspace_id is null
     or referenced_goal_workspace_id <> new.workspace_id then
    raise exception using
      errcode = '23514',
      message = 'contribution and goal must belong to the same workspace';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validate_contribution_goal_on_insert()
  from public, anon, authenticated;--> statement-breakpoint

create trigger validate_contribution_goal_on_insert
  before insert on public.transactions
  for each row
  execute function public.validate_contribution_goal_on_insert();

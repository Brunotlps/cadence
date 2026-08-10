-- Falha antes de qualquer DDL se houver dado anterior incompatível. Não corrige,
-- reclassifica ou apaga contas fixas silenciosamente.
--
-- `category` é obrigatória a partir desta etapa e não tem origem possível numa
-- linha antiga: a tabela nunca foi escrita pela aplicação, então não existe valor
-- histórico a derivar. Um backfill aqui seria inventar dado financeiro. Se alguma
-- linha existir, a migration para e exige uma decisão explícita de dados.
do $$
begin
  if exists (select 1 from public.fixed_bills) then
    raise exception using
      errcode = '23514',
      message = 'existing fixed_bills rows cannot be backfilled with a category';
  end if;

  if exists (
    select 1
    from public.transactions
    where kind not in ('expense', 'income', 'contribution')
  ) then
    raise exception using
      errcode = '23514',
      message = 'existing transactions violate the expected kind domain';
  end if;
end;
$$;--> statement-breakpoint

ALTER TABLE "fixed_bills" ALTER COLUMN "due_day" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "fixed_bills" ALTER COLUMN "estimated_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD COLUMN "category" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD COLUMN "variable_amount" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD COLUMN "started_on" date DEFAULT (timezone('America/Sao_Paulo', now()))::date NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fixed_bill_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fixed_bill_id_fixed_bills_id_fk" FOREIGN KEY ("fixed_bill_id") REFERENCES "public"."fixed_bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_bills_workspace_name_idx" ON "fixed_bills" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "transactions_fixed_bill_idx" ON "transactions" USING btree ("workspace_id","fixed_bill_id","occurred_on" DESC NULLS LAST) WHERE "transactions"."fixed_bill_id" is not null;--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_name_check" CHECK (btrim("fixed_bills"."name") <> '' and char_length("fixed_bills"."name") <= 100);--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_due_day_check" CHECK ("fixed_bills"."due_day" between 1 and 31);--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_estimated_amount_positive_check" CHECK ("fixed_bills"."estimated_amount" > 0 and "fixed_bills"."estimated_amount" <> 'NaN'::numeric);--> statement-breakpoint
ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_category_check" CHECK ("fixed_bills"."category" in (
        'alimentacao', 'aluguel', 'assinaturas', 'automoveis',
        'combustivel', 'condominio', 'internet', 'lazer', 'luz', 'saude'
      ));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fixed_bill_kind_check" CHECK ("transactions"."fixed_bill_id" is null or "transactions"."kind" = 'expense');--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_single_link_check" CHECK (not ("transactions"."goal_id" is not null and "transactions"."fixed_bill_id" is not null));--> statement-breakpoint

-- `started_on` é derivado no banco e não pode ser forjado no insert nem reescrito
-- depois. Nome, dia, categoria, débito automático e estimativa permanecem campos de
-- negócio editáveis. Espelha protect_goal_system_fields da migration 0007.
create function public.protect_fixed_bill_system_fields()
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
        message = 'fixed bill system fields are immutable';
    end if;
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.protect_fixed_bill_system_fields()
  from public, anon, authenticated;--> statement-breakpoint

create trigger protect_fixed_bill_system_fields
  before insert or update on public.fixed_bills
  for each row
  execute function public.protect_fixed_bill_system_fields();--> statement-breakpoint

-- Diferença deliberada em relação a aportes: despesa avulsa sem conta fixa é o caso
-- normal, então a validação é condicionada ao vínculo pelo WHEN da trigger, em vez
-- de exigir fixed_bill_id como validate_contribution_goal_on_insert exige goal_id.
-- O mesmo WHEN deixa o ON DELETE SET NULL do FK gravar NULL ao encerrar a
-- recorrência, preservando o pagamento já feito.
create function public.validate_fixed_bill_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  referenced_bill_workspace_id uuid;
begin
  select workspace_id
  into referenced_bill_workspace_id
  from public.fixed_bills
  where id = new.fixed_bill_id;

  if referenced_bill_workspace_id is null
     or referenced_bill_workspace_id <> new.workspace_id then
    raise exception using
      errcode = '23514',
      message = 'payment and fixed bill must belong to the same workspace';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.validate_fixed_bill_link()
  from public, anon, authenticated;--> statement-breakpoint

create trigger validate_fixed_bill_link_on_insert
  before insert on public.transactions
  for each row
  when (new.fixed_bill_id is not null)
  execute function public.validate_fixed_bill_link();--> statement-breakpoint

create trigger validate_fixed_bill_link_on_update
  before update of fixed_bill_id on public.transactions
  for each row
  when (new.fixed_bill_id is not null)
  execute function public.validate_fixed_bill_link();
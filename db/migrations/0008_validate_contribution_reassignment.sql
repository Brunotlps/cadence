-- A criação do aporte continua protegida pela trigger de INSERT da migration 0007.
-- A reatribuição altera goal_id por UPDATE e precisa da mesma garantia de workspace.
-- O WHEN exclui explicitamente goal_id = NULL, portanto o UPDATE interno do FK
-- ON DELETE SET NULL continua preservando aportes de metas apagadas.
create function public.validate_contribution_goal_on_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  referenced_goal_workspace_id uuid;
begin
  if TG_OP <> 'UPDATE' or new.goal_id is null then
    return new;
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

revoke execute on function public.validate_contribution_goal_on_update()
  from public, anon, authenticated;--> statement-breakpoint

create trigger validate_contribution_goal_on_update
  before update of goal_id on public.transactions
  for each row
  when (new.goal_id is not null)
  execute function public.validate_contribution_goal_on_update();

-- Custom SQL migration file, put your code below! --

-- Apagamento de conta: remove participações do usuário e qualquer workspace
-- que fique sem membros (cascata apaga transactions/fixed_bills/goals desse
-- workspace), depois o espelho de perfil. Chamada só pelo módulo isolado de
-- service-role (lib/supabase/admin.ts, subtarefa 5), nunca pela aplicação
-- em nome do próprio usuário.
--
-- Nota: transactions/fixed_bills/goals de um workspace que continua com
-- outros membros NÃO são apagados nem têm created_by limpo — são dados do
-- workspace compartilhado, não dados pessoais exclusivos do usuário que saiu.
-- O apagamento do registro em auth.users é feito à parte, via API admin do
-- Supabase, depois desta função (ver lib/supabase/admin.ts).
create function public.handle_account_deletion(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from workspace_members where user_id = target;

  delete from workspaces w
  where not exists (
    select 1 from workspace_members m where m.workspace_id = w.id
  );

  delete from profiles where id = target;
end;
$$;

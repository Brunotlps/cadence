-- Custom SQL migration file, put your code below! --

-- Supabase concede USAGE no schema public e alguns privilégios (TRIGGER,
-- REFERENCES, TRUNCATE) por padrão para anon/authenticated/service_role, mas
-- SELECT/INSERT/UPDATE/DELETE só são concedidos automaticamente quando a
-- tabela é criada pela própria ferramenta da plataforma (Studio/Dashboard) —
-- não quando o DDL roda por uma conexão externa como o drizzle-kit. RLS só
-- restringe linhas depois que o role já tem o privilégio na tabela; sem este
-- grant, toda query falha com "permission denied" mesmo com policy correta.
--
-- anon não recebe nada aqui: não há dado público nem rota sem sessão neste
-- produto.
grant select, insert, update, delete
  on public.workspaces, public.workspace_members, public.transactions,
     public.fixed_bills, public.goals, public.profiles
  to authenticated;

grant select, insert, update, delete
  on public.workspaces, public.workspace_members, public.transactions,
     public.fixed_bills, public.goals, public.profiles
  to service_role;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.create_workspace_with_owner(text) to authenticated;

-- Custom SQL migration file, put your code below! --

-- Restringe workspace_members.role a um conjunto fechado de valores, já que
-- as policies abaixo passam a decidir permissões com base nesse campo.
alter table "workspace_members"
  add constraint "workspace_members_role_check" check (role in ('owner', 'member'));

-- Helper usado dentro de USING/WITH CHECK das policies de dado por workspace.
-- SECURITY DEFINER + search_path fixo evitam hijacking via search_path e
-- permitem checar workspace_members sem depender das próprias policies dessa
-- tabela (senão nenhuma query conseguiria nem avaliar a policy).
create function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = ws
      and user_id = auth.uid()
  );
$$;

-- workspaces: só select/update para membros. Sem insert direto (criação passa
-- por create_workspace_with_owner) nem delete direto (via handle_account_deletion).
alter table "workspaces" enable row level security;

create policy "workspaces_select_member"
  on "workspaces" for select
  using (is_workspace_member(id));

create policy "workspaces_update_member"
  on "workspaces" for update
  using (is_workspace_member(id))
  with check (is_workspace_member(id));

-- workspace_members: só select para membros do mesmo workspace. Sem
-- insert/update/delete para usuários comuns — bootstrap via
-- create_workspace_with_owner, gestão de convites/membros fica fora do MVP.
alter table "workspace_members" enable row level security;

create policy "workspace_members_select_member"
  on "workspace_members" for select
  using (is_workspace_member(workspace_id));

-- transactions, fixed_bills, goals: CRUD completo para qualquer membro do
-- workspace.
alter table "transactions" enable row level security;

create policy "transactions_select_member"
  on "transactions" for select
  using (is_workspace_member(workspace_id));

create policy "transactions_insert_member"
  on "transactions" for insert
  with check (is_workspace_member(workspace_id));

create policy "transactions_update_member"
  on "transactions" for update
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "transactions_delete_member"
  on "transactions" for delete
  using (is_workspace_member(workspace_id));

alter table "fixed_bills" enable row level security;

create policy "fixed_bills_select_member"
  on "fixed_bills" for select
  using (is_workspace_member(workspace_id));

create policy "fixed_bills_insert_member"
  on "fixed_bills" for insert
  with check (is_workspace_member(workspace_id));

create policy "fixed_bills_update_member"
  on "fixed_bills" for update
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "fixed_bills_delete_member"
  on "fixed_bills" for delete
  using (is_workspace_member(workspace_id));

alter table "goals" enable row level security;

create policy "goals_select_member"
  on "goals" for select
  using (is_workspace_member(workspace_id));

create policy "goals_insert_member"
  on "goals" for insert
  with check (is_workspace_member(workspace_id));

create policy "goals_update_member"
  on "goals" for update
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "goals_delete_member"
  on "goals" for delete
  using (is_workspace_member(workspace_id));

-- profiles: isolado por linha própria (auth.uid()), não por workspace.
alter table "profiles" enable row level security;

create policy "profiles_select_own"
  on "profiles" for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on "profiles" for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Bootstrap de workspace_members: cria workspace + primeiro membro (owner)
-- atomicamente, contornando o problema de a policy de insert exigir
-- membership prévia para inserir o próprio primeiro membro.
create function public.create_workspace_with_owner(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (name)
  values (workspace_name)
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

-- Bootstrap de profiles: espelha auth.users em public.profiles no momento do
-- signup. Roda no contexto do evento de criação do usuário (trigger em
-- auth.users), não depende de auth.uid() nem de a aplicação inserir após o
-- signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

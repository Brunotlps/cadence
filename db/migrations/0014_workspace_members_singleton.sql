-- Custom SQL migration file, put your code below! --

-- O produto assume um workspace por pessoa. Antes de instalar a constraint
-- global por user_id, falha explicitamente se o banco já tiver histórico
-- incompatível, sem apagar ou escolher uma membership silenciosamente.
do $$
begin
  if exists (
    select 1
    from public.workspace_members
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'workspace_members_user_id_not_singleton';
  end if;
end;
$$;

alter table public.workspace_members
  add constraint workspace_members_user_id_unique unique (user_id);

-- Criação inicial de workspace: o owner continua derivado exclusivamente de
-- auth.uid(). A checagem antecipada dá erro tipado estável; a constraint acima
-- fecha a corrida concorrente e é traduzida para o mesmo erro.
create or replace function public.create_workspace_with_owner(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
  violated_constraint text;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1 from workspace_members where user_id = current_user_id
  ) then
    raise exception 'already_has_workspace';
  end if;

  insert into workspaces (name)
  values (workspace_name)
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;

    if violated_constraint = 'workspace_members_user_id_unique' then
      raise exception 'already_has_workspace';
    end if;

    raise;
end;
$$;

-- O resgate já recusava usuários com workspace. Com a nova constraint, uma
-- corrida contra outro fluxo de criação/resgate deve continuar retornando o
-- mesmo erro tipado em vez de vazar duplicate key.
create or replace function public.redeem_workspace_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  current_user_id uuid := auth.uid();
  violated_constraint text;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1 from workspace_members where user_id = current_user_id
  ) then
    raise exception 'already_has_workspace';
  end if;

  select * into invite
  from workspace_invites
  where token = invite_token
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid_or_expired';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (invite.workspace_id, current_user_id, 'member');

  update workspace_invites
  set used_at = now(), used_by = current_user_id
  where id = invite.id;

  return invite.workspace_id;
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;

    if violated_constraint in (
      'workspace_members_user_id_unique',
      'workspace_members_workspace_id_user_id_pk'
    ) then
      raise exception 'already_has_workspace';
    end if;

    raise;
end;
$$;

revoke execute on function public.create_workspace_with_owner(text) from public;
revoke execute on function public.create_workspace_with_owner(text) from anon;
grant execute on function public.create_workspace_with_owner(text) to authenticated;

revoke execute on function public.redeem_workspace_invite(uuid) from public;
revoke execute on function public.redeem_workspace_invite(uuid) from anon;
grant execute on function public.redeem_workspace_invite(uuid) to authenticated;

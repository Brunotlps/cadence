-- Custom SQL migration file, put your code below! --

-- workspace_invites: só select para membros do workspace do convite (lista
-- de convites pendentes). Sem insert/update/delete para usuário comum —
-- criação e resgate passam pelas duas funções SECURITY DEFINER abaixo,
-- mesmo padrão de create_workspace_with_owner (0001).
alter table "workspace_invites" enable row level security;

create policy "workspace_invites_select_member"
  on "workspace_invites" for select
  using (is_workspace_member(workspace_id));

-- Cria um convite de uso único, válido por 7 dias, para o workspace do
-- chamador. Token é o próprio default aleatório da coluna (uuid) — não
-- recebido do cliente, evita que alguém force um token previsível.
create function public.create_workspace_invite(target_workspace_id uuid)
returns table(token uuid, expires_at timestamp)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token uuid;
  new_expires_at timestamp;
begin
  if not is_workspace_member(target_workspace_id) then
    raise exception 'not_a_member';
  end if;

  new_expires_at := now() + interval '7 days';

  insert into workspace_invites (workspace_id, created_by, expires_at)
  values (target_workspace_id, auth.uid(), new_expires_at)
  returning workspace_invites.token into new_token;

  return query select new_token, new_expires_at;
end;
$$;

-- Resgata um convite: recusa se quem chama já participa de algum workspace
-- (o app inteiro assume um workspace por pessoa — ver
-- lib/workspace/repository.ts) ou se o token não existe, já foi usado ou
-- expirou. SECURITY DEFINER porque quem resgata ainda não é membro do
-- workspace do convite e não teria select em workspace_invites daquele
-- workspace pela policy acima.
create function public.redeem_workspace_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
begin
  if exists (
    select 1 from workspace_members where user_id = auth.uid()
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
  values (invite.workspace_id, auth.uid(), 'member');

  update workspace_invites
  set used_at = now(), used_by = auth.uid()
  where id = invite.id;

  return invite.workspace_id;
end;
$$;

grant select on public.workspace_invites to authenticated;
grant select, insert, update, delete on public.workspace_invites to service_role;

revoke execute on function public.create_workspace_invite(uuid) from public;
revoke execute on function public.create_workspace_invite(uuid) from anon;
grant execute on function public.create_workspace_invite(uuid) to authenticated;

revoke execute on function public.redeem_workspace_invite(uuid) from public;
revoke execute on function public.redeem_workspace_invite(uuid) from anon;
grant execute on function public.redeem_workspace_invite(uuid) to authenticated;

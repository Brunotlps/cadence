-- Custom SQL migration file, put your code below! --

-- Etapa 18: permite que um membro do workspace leia o profile (display_name,
-- accent_color) de outro membro do mesmo workspace, para exibir identificação
-- visual de quem participa (iniciais em círculo colorido no dashboard).
-- Policy aditiva: RLS combina policies com OR, então profiles_select_own
-- (migration 0001) continua valendo — isso só amplia o que já era visível
-- para o próprio dono da linha, nunca restringe.
create policy "profiles_select_workspace_members"
  on "profiles" for select
  using (
    exists (
      select 1 from workspace_members theirs
      where theirs.user_id = profiles.id
        and is_workspace_member(theirs.workspace_id)
    )
  );
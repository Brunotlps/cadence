import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateWorkspaceInviteResult = {
  error: string | null;
  token?: string;
  expiresAt?: string;
};

// target_workspace_id evita colidir com a coluna workspace_id dentro da
// função (ver db/migrations/0013_workspace_invites_rls_and_functions.sql).
export async function createWorkspaceInvite(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CreateWorkspaceInviteResult> {
  const { data, error } = await supabase.rpc("create_workspace_invite", {
    target_workspace_id: workspaceId,
  });

  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    return { error: "Não foi possível gerar o convite. Tente novamente." };
  }

  return { error: null, token: row.token, expiresAt: row.expires_at };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateWorkspaceResult = { error: string | null; workspaceId?: string };

// Owner deriva de auth.uid() dentro da função (security definer) — nunca
// passamos o user id daqui, evita um cliente forjar workspace pra outro dono.
export async function createWorkspace(
  supabase: SupabaseClient,
  name: string,
): Promise<CreateWorkspaceResult> {
  const { data, error } = await supabase.rpc("create_workspace_with_owner", {
    workspace_name: name,
  });

  if (error) {
    return { error: "Não foi possível criar o espaço. Tente novamente." };
  }

  return { error: null, workspaceId: data as string };
}

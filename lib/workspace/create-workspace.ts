import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateWorkspaceErrorCode =
  | "already_has_workspace"
  | "create_failed";

export type CreateWorkspaceResult =
  | { error: null; workspaceId: string }
  | { error: string; code: CreateWorkspaceErrorCode; workspaceId?: undefined };

const CREATE_WORKSPACE_ERROR =
  "Não foi possível criar o espaço. Tente novamente.";
const ALREADY_HAS_WORKSPACE_ERROR =
  "Você já participa de um espaço no Cadence.";

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
    if (error.message.includes("already_has_workspace")) {
      return {
        error: ALREADY_HAS_WORKSPACE_ERROR,
        code: "already_has_workspace",
      };
    }

    return { error: CREATE_WORKSPACE_ERROR, code: "create_failed" };
  }

  return { error: null, workspaceId: data as string };
}

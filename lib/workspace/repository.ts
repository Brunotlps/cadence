import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentWorkspace = {
  id: string;
  name: string;
};

export type WorkspaceRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: "query_failed" };

export async function getCurrentWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceRepositoryResult<CurrentWorkspace | null>> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: "query_failed" };
  if (!data) return { data: null, error: null };

  const membership = data as unknown as {
    workspace_id: string;
    workspaces: { name: string } | Array<{ name: string }> | null;
  };
  const workspace = Array.isArray(membership.workspaces)
    ? membership.workspaces[0]
    : membership.workspaces;

  if (!workspace) return { data: null, error: "query_failed" };

  return {
    data: { id: membership.workspace_id, name: workspace.name },
    error: null,
  };
}

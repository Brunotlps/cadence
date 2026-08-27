import type { SupabaseClient } from "@supabase/supabase-js";

export type CurrentWorkspace = {
  id: string;
  name: string;
};

export type WorkspaceMember = {
  userId: string;
  displayName: string | null;
  accentColor: string;
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

// Duas consultas porque workspace_members.user_id e profiles.id não têm FK
// entre si (nenhuma das duas referencia auth.users no schema público) — o
// PostgREST não consegue montar o embed automático que getCurrentWorkspace
// usa para workspaces(name).
export async function listWorkspaceMembers(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceRepositoryResult<WorkspaceMember[]>> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (membershipsError) return { data: null, error: "query_failed" };
  if (!memberships || memberships.length === 0) return { data: [], error: null };

  const orderedUserIds = memberships.map(
    (membership) => membership.user_id as string,
  );

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, accent_color")
    .in("id", orderedUserIds);

  if (profilesError) return { data: null, error: "query_failed" };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      profile as { id: string; display_name: string | null; accent_color: string },
    ]),
  );

  const members = orderedUserIds.flatMap((userId) => {
    const profile = profileById.get(userId);
    if (!profile) return [];

    return [
      {
        userId,
        displayName: profile.display_name,
        accentColor: profile.accent_color,
      },
    ];
  });

  return { data: members, error: null };
}

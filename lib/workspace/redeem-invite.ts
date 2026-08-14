import type { SupabaseClient } from "@supabase/supabase-js";

export type RedeemWorkspaceInviteResult =
  | { status: "ok"; workspaceId: string }
  | { status: "already_has_workspace" }
  | { status: "invalid_or_expired" }
  | { status: "error" };

export async function redeemWorkspaceInvite(
  supabase: SupabaseClient,
  token: string,
): Promise<RedeemWorkspaceInviteResult> {
  const { data, error } = await supabase.rpc("redeem_workspace_invite", {
    invite_token: token,
  });

  if (error) {
    if (error.message.includes("already_has_workspace")) {
      return { status: "already_has_workspace" };
    }
    if (error.message.includes("invalid_or_expired")) {
      return { status: "invalid_or_expired" };
    }
    return { status: "error" };
  }

  return { status: "ok", workspaceId: data as string };
}

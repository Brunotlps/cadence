"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace } from "@/lib/workspace/create-workspace";
import { createWorkspaceInvite } from "@/lib/workspace/create-invite";
import { redeemWorkspaceInvite } from "@/lib/workspace/redeem-invite";
import { getCurrentWorkspace } from "@/lib/workspace/repository";

export type CreateWorkspaceState = { error: string | null };

export async function createWorkspaceAction(
  _prevState: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const name = String(formData.get("name"));
  const supabase = await createClient();

  const { error } = await createWorkspace(supabase, name);
  if (error) {
    return { error };
  }

  redirect("/dashboard");
}

export type CreateWorkspaceInviteState = {
  error: string | null;
  token: string | null;
  expiresAt: string | null;
};

const NO_SESSION_ERROR = "Sessão expirada. Faça login novamente.";
const NO_WORKSPACE_ERROR = "Você ainda não tem um espaço.";
const CREATE_INVITE_ERROR = "Não foi possível gerar o convite. Tente novamente.";

export async function createWorkspaceInviteAction(
  _prevState: CreateWorkspaceInviteState,
  _formData: FormData,
): Promise<CreateWorkspaceInviteState> {
  void _formData;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NO_SESSION_ERROR, token: null, expiresAt: null };
  }

  const workspaceResult = await getCurrentWorkspace(supabase, user.id);
  if (workspaceResult.error || !workspaceResult.data) {
    return { error: NO_WORKSPACE_ERROR, token: null, expiresAt: null };
  }

  const result = await createWorkspaceInvite(supabase, workspaceResult.data.id);
  if (result.error !== null || !result.token || !result.expiresAt) {
    return { error: result.error ?? CREATE_INVITE_ERROR, token: null, expiresAt: null };
  }

  return { error: null, token: result.token, expiresAt: result.expiresAt };
}

export type RedeemWorkspaceInviteActionResult =
  | { status: "ok" }
  | { status: "already_has_workspace" }
  | { status: "invalid_or_expired" }
  | { status: "error" };

export async function redeemWorkspaceInviteAction(
  token: string,
): Promise<RedeemWorkspaceInviteActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "error" };
  }

  const result = await redeemWorkspaceInvite(supabase, token);
  if (result.status === "ok") {
    return { status: "ok" };
  }

  return { status: result.status };
}

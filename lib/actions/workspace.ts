"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace } from "@/lib/workspace/create-workspace";

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

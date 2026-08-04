import type { SupabaseClient } from "@supabase/supabase-js";

export type UpdatePasswordResult = { error: string | null };

export async function updatePassword(
  supabase: SupabaseClient,
  newPassword: string,
): Promise<UpdatePasswordResult> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: "Não foi possível redefinir a senha. Verifique os dados e tente novamente." };
  }

  return { error: null };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  return { error: error ? "Não foi possível sair. Tente novamente." : null };
}

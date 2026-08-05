import type { SupabaseClient } from "@supabase/supabase-js";

const GENERIC_MESSAGE = "Se a conta existir e ainda não estiver confirmada, reenviamos o e-mail.";

// Mesma lógica de request-password-reset.ts: mensagem fixa, independente do
// Supabase reportar erro (ex: e-mail já confirmado) — decisão 6 da etapa 05.
export async function resendConfirmation(
  supabase: SupabaseClient,
  email: string,
  { emailRedirectTo }: { emailRedirectTo: string },
): Promise<{ message: string }> {
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  return { message: GENERIC_MESSAGE };
}

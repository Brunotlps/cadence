import type { SupabaseClient } from "@supabase/supabase-js";

const GENERIC_MESSAGE =
  "Se esse e-mail estiver cadastrado, você vai receber um link de recuperação em instantes.";

// Mensagem fixa, independente do resultado real (e-mail existe ou não,
// Supabase responde erro ou não) — decisão 6 da etapa 05. Erro real de
// infraestrutura (ex: rate limit) não é reportado à UI aqui de propósito:
// qualquer diferença de resposta vira um sinal de enumeração.
export async function requestPasswordReset(
  supabase: SupabaseClient,
  email: string,
  { redirectTo }: { redirectTo: string },
): Promise<{ message: string }> {
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { message: GENERIC_MESSAGE };
}

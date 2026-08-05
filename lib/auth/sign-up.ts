import type { SupabaseClient } from "@supabase/supabase-js";

export type SignUpResult = { error: string | null };

// Se o e-mail já existe e está confirmado, o Supabase já responde sem erro
// (identities: []), sem reenviar confirmação — comportamento nativo de
// anti-enumeração. Não precisamos (nem devemos) tratar esse caso à parte:
// qualquer diferença de resposta aqui seria o sinal de enumeração que a
// decisão 6 da etapa 05 tenta evitar.
export async function signUp(
  supabase: SupabaseClient,
  { email, password }: { email: string; password: string },
  { emailRedirectTo }: { emailRedirectTo: string },
): Promise<SignUpResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    return { error: "Não foi possível criar a conta. Verifique os dados e tente novamente." };
  }

  return { error: null };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type SignInResult = { error: string | null };

// Mensagem genérica pra qualquer falha, incluindo e-mail não confirmado.
// Diferenciar esse caso (como uma versão anterior deste arquivo fazia)
// vira um oráculo de enumeração pelo próprio formulário de login: um
// atacante descobre se um e-mail está cadastrado sem precisar acertar a
// senha, só olhando qual mensagem volta. A decisão 6 da etapa 05 escopava
// isso só pra cadastro/recuperação — esse caso mostrou que login também
// precisa do mesmo tratamento quando a distinção é "conta existe, não
// confirmada" vs "credenciais erradas".
export async function signIn(
  supabase: SupabaseClient,
  { email, password }: { email: string; password: string },
): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    return { error: null };
  }

  return { error: "E-mail ou senha inválidos." };
}

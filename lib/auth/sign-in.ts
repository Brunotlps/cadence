import type { SupabaseClient } from "@supabase/supabase-js";

export type SignInResult = {
  error: string | null;
  needsConfirmation?: boolean;
};

// Diferenciar "e-mail não confirmado" de "credenciais inválidas" aqui não é
// enumeração — só faz sentido tentar logar com um e-mail se você já sabe que
// a conta existe. É a decisão 6 da etapa 05 (erro genérico) que só se aplica
// a cadastro e recuperação de senha.
export async function signIn(
  supabase: SupabaseClient,
  { email, password }: { email: string; password: string },
): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    return { error: null };
  }

  if (error.code === "email_not_confirmed") {
    return {
      error: "Confirme seu e-mail antes de entrar.",
      needsConfirmation: true,
    };
  }

  return { error: "E-mail ou senha inválidos." };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type SignInWithGoogleResult = {
  url: string | null;
  error: string | null;
};

export async function signInWithGoogle(
  supabase: SupabaseClient,
  { redirectTo }: { redirectTo: string },
): Promise<SignInWithGoogleResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return {
      url: null,
      error: "Não foi possível iniciar o login com o Google. Tente novamente.",
    };
  }

  return { url: data.url, error: null };
}

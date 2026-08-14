"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/lib/auth/sign-in-with-google";
import { signOut } from "@/lib/auth/sign-out";
import { safeNextPath } from "@/lib/navigation/safe-next-path";

// Cascas finas sobre lib/auth/* (decisão 13, etapa 05): só leem FormData,
// resolvem a origin da requisição e traduzem o resultado em redirect ou erro
// pra tela chamar. Nenhuma regra de negócio mora aqui.
//
// O header Host é entrada não confiável (pode ser forjado pelo cliente) e vai
// direto pro redirect do OAuth — usá-lo sem validação permite host header
// injection. Em produção, exigimos APP_URL (fixada no ambiente de deploy) e
// nunca caímos pro header — um `APP_URL` esquecido derruba a Server Action em
// vez de reabrir a falha em silêncio. O fallback pro header só existe fora de
// produção (dev/test local, onde a porta varia e não há exposição real).
async function requestOrigin() {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.APP_URL) {
      throw new Error("APP_URL precisa estar configurada em produção.");
    }
    return process.env.APP_URL;
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  return `${proto}://${host}`;
}

// Assinatura (prevState, formData) em vez de só (formData): a tela usa
// useActionState (React 19) pra exibir erro sem JS extra de estado local.
export type SignInWithGoogleState = { error: string | null };

export async function signInWithGoogleAction(
  _prevState: SignInWithGoogleState,
  formData: FormData,
): Promise<SignInWithGoogleState> {
  void _prevState;
  const supabase = await createClient();
  const origin = await requestOrigin();
  const next = safeNextPath(formData.get("next")?.toString() ?? null, "/dashboard");

  const result = await signInWithGoogle(supabase, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
  });

  if (result.error || !result.url) {
    return { error: result.error };
  }

  redirect(result.url);
}

export async function signOutAction() {
  const supabase = await createClient();
  await signOut(supabase);
  redirect("/login");
}

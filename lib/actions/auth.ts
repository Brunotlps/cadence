"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "@/lib/auth/sign-up";
import { signIn } from "@/lib/auth/sign-in";
import { signOut } from "@/lib/auth/sign-out";
import { requestPasswordReset } from "@/lib/auth/request-password-reset";
import { updatePassword } from "@/lib/auth/update-password";
import { resendConfirmation } from "@/lib/auth/resend-confirmation";

// Cascas finas sobre lib/auth/* (decisão 13, etapa 05): só leem FormData,
// resolvem a origin da requisição e traduzem o resultado em redirect ou erro
// pra tela chamar. Nenhuma regra de negócio mora aqui.
//
// Em produção, o header Host é entrada não confiável (pode ser forjado pelo
// cliente) e vai direto pro link de confirmação/recuperação enviado por
// e-mail — usá-lo sem validação permite um ataque de host header injection
// (e-mail legítimo do Cadence com link apontando pra domínio do atacante).
// Por isso confiamos em APP_URL, fixado no ambiente de deploy, e só caímos
// pro header em dev/test, onde a porta local varia e não há risco real.
async function requestOrigin() {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  return `${proto}://${host}`;
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const origin = await requestOrigin();

  const { error } = await signUp(
    supabase,
    { email, password },
    { emailRedirectTo: `${origin}/auth/callback?next=/onboarding/workspace` },
  );

  if (error) {
    return { error };
  }

  redirect("/confirm-email");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();

  const result = await signIn(supabase, { email, password });
  if (result.error) {
    return result;
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await signOut(supabase);
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  const origin = await requestOrigin();

  return requestPasswordReset(supabase, email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
}

export async function updatePasswordAction(formData: FormData) {
  const newPassword = String(formData.get("password"));
  const supabase = await createClient();

  const { error } = await updatePassword(supabase, newPassword);
  if (error) {
    return { error };
  }

  redirect("/login");
}

export async function resendConfirmationAction(formData: FormData) {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  const origin = await requestOrigin();

  return resendConfirmation(supabase, email, {
    emailRedirectTo: `${origin}/auth/callback?next=/onboarding/workspace`,
  });
}

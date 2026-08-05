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
// O header Host é entrada não confiável (pode ser forjado pelo cliente) e vai
// direto pro link de confirmação/recuperação enviado por e-mail — usá-lo sem
// validação permite host header injection (e-mail legítimo do Cadence com
// link apontando pro domínio do atacante). Em produção, exigimos APP_URL
// (fixada no ambiente de deploy) e nunca caímos pro header — um `APP_URL`
// esquecido derruba a Server Action em vez de reabrir a falha em silêncio.
// O fallback pro header só existe fora de produção (dev/test local, onde a
// porta varia e não há exposição real).
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

// Assinatura (prevState, formData) em vez de só (formData): as telas usam
// useActionState (React 19) pra exibir erro/mensagem sem JS extra de estado
// local.
export type SignUpState = { error: string | null };

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
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

export type SignInState = { error: string | null };

export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
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

export type RequestPasswordResetState = { message: string | null };

export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  const origin = await requestOrigin();

  return requestPasswordReset(supabase, email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
}

export type UpdatePasswordState = { error: string | null };

export async function updatePasswordAction(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const newPassword = String(formData.get("password"));
  const supabase = await createClient();

  const { error } = await updatePassword(supabase, newPassword);
  if (error) {
    return { error };
  }

  redirect("/login");
}

export type ResendConfirmationState = { message: string | null };

export async function resendConfirmationAction(
  _prevState: ResendConfirmationState,
  formData: FormData,
): Promise<ResendConfirmationState> {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  const origin = await requestOrigin();

  return resendConfirmation(supabase, email, {
    emailRedirectTo: `${origin}/auth/callback?next=/onboarding/workspace`,
  });
}

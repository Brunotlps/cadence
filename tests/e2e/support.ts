import { createClient } from "@supabase/supabase-js";

// Espelha tests/compliance/support.ts — mantido separado porque testes E2E
// (Playwright) e testes de compliance (Vitest) rodam em runners diferentes e
// não compartilham setup.
function createTestAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function hasSupabaseTestEnv(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function deleteTestAccount(userId: string) {
  const supabase = createTestAdminClient();
  await supabase.rpc("handle_account_deletion", { target: userId });
  await supabase.auth.admin.deleteUser(userId);
}

export async function deleteTestAccountByEmail(email: string) {
  const admin = createTestAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;

  const user = data.users.find((u) => u.email === email);
  if (user) await deleteTestAccount(user.id);
}

export async function createConfirmedTestUser(prefix: string) {
  const admin = createTestAdminClient();
  const password = crypto.randomUUID();
  const email = `${prefix}-${crypto.randomUUID()}@example.com`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  return { id: data.user.id, email, password };
}

// process.env.PLAYWRIGHT_BASE_URL, mesmo default de playwright.config.ts —
// sem isso, o link gerado usaria a Site URL de produção configurada no
// Supabase, não o servidor local que o Playwright sobe pra rodar os testes.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Gera o link de confirmação de cadastro sem enviar e-mail de verdade —
// permite testar o fluxo real de confirmação (clicar no link) sem depender
// de infraestrutura de leitura de e-mail no teste.
export async function generateSignupConfirmationLink(
  email: string,
  password: string,
) {
  const admin = createTestAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: `${BASE_URL}/auth/callback?next=/onboarding/workspace`,
    },
  });
  if (error) throw error;
  return data.properties.action_link;
}

export async function generateRecoveryLink(email: string) {
  const admin = createTestAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${BASE_URL}/auth/callback?next=/reset-password`,
    },
  });
  if (error) throw error;
  return data.properties.action_link;
}

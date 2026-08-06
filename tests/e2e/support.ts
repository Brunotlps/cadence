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

// Em sessões recém-emitidas, o Auth e o PostgREST podem observar alguns
// milissegundos de diferença de relógio e responder PGRST303 (JWT issued at future).
// Repete somente esse erro transitório uma vez; qualquer outra falha continua
// imediata e visível para o teste.
export async function retryAfterJwtClockSkew<
  TResult extends { error: { code?: string } | null },
>(operation: () => PromiseLike<TResult>): Promise<TResult> {
  const firstResult = await operation();
  if (firstResult.error?.code !== "PGRST303") return firstResult;

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return operation();
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

// Provisiona o estado anterior ao Dashboard pelo mesmo caminho autenticado da
// aplicação: usuário via Admin API apenas como fixture, seguido de login anon +
// create_workspace_with_owner com RLS/grants reais. Escritas de dado financeiro nos
// testes continuam usando o client retornado, nunca service-role.
export async function createDashboardTestUser(
  prefix: string,
  workspaceName: string,
) {
  const user = await createConfirmedTestUser(prefix);

  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signInError) throw signInError;

    const { data: workspaceId, error: workspaceError } =
      await retryAfterJwtClockSkew(() =>
        client.rpc("create_workspace_with_owner", {
          workspace_name: workspaceName,
        }),
      );
    if (workspaceError) throw workspaceError;

    return { ...user, workspaceId: workspaceId as string, client };
  } catch (error) {
    await deleteTestAccount(user.id);
    throw error;
  }
}

// process.env.PLAYWRIGHT_BASE_URL, mesmo default de playwright.config.ts —
// sem isso, o link gerado usaria a Site URL de produção configurada no
// Supabase, não o servidor local que o Playwright sobe pra rodar os testes.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Gera o link de confirmação de cadastro sem enviar e-mail de verdade —
// permite testar o fluxo real de confirmação (clicar no link) sem depender
// de infraestrutura de leitura de e-mail no teste.
//
// Monta o link direto pra nossa própria rota de callback com token_hash+type
// em vez de usar `action_link` (que aponta pro endpoint hospedado do
// Supabase, `/auth/v1/verify` — devolve a sessão no fragmento da URL, fluxo
// implícito, que nosso callback não processa). Mesma URL que os templates de
// e-mail customizados (decisão 8) geram de verdade — action_link e
// hashed_token vêm da mesma chamada, só apontam pra lugares diferentes.
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
  return `${BASE_URL}/auth/callback?token_hash=${data.properties.hashed_token}&type=signup&next=/onboarding/workspace`;
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
  return `${BASE_URL}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`;
}

import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const REQUIRED_SUPABASE_TEST_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

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
  const missing = REQUIRED_SUPABASE_TEST_ENV.filter((name) => !process.env[name]);

  if (missing.length > 0 && process.env.CI === "true") {
    throw new Error(
      `Missing required Supabase test environment variables: ${missing.join(", ")}`,
    );
  }

  return missing.length === 0;
}

export async function deleteTestAccount(userId: string) {
  const supabase = createTestAdminClient();
  await supabase.rpc("handle_account_deletion", { target: userId });
  await supabase.auth.admin.deleteUser(userId);
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

// Autentica o NAVEGADOR (não só um cliente Node) sem passar pela UI —
// necessário desde a Etapa 16, que tirou o formulário de e-mail/senha de
// `/login` e deixou só o botão do Google, não automatizável em E2E. Assina
// uma sessão real via signInWithPassword (a API do Supabase continua
// aceitando senha, só a nossa UI parou de expor isso) e troca os tokens por
// cookies de sessão através da rota de bypass `/auth/test-session`, que só
// existe fora de produção. `page.request` compartilha o cookie jar do
// `page`, então os cookies que a rota escreve na resposta já ficam
// disponíveis pro navegador nas navegações seguintes.
export async function authenticateBrowser(
  page: Page,
  email: string,
  password: string,
) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error("login de teste: signInWithPassword não devolveu sessão");
  }

  const response = await page.request.post("/auth/test-session", {
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  });
  if (!response.ok()) {
    throw new Error(
      `login de teste: bypass /auth/test-session falhou (${response.status()})`,
    );
  }
}

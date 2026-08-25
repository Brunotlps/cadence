import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const REQUIRED_SUPABASE_TEST_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

// Conexão administrativa exclusivamente para provas de invariantes no banco.
// Não é importada por runtime, não usa service-role e só é aberta pelos testes de
// compliance quando o ambiente hospedado autorizado fornece DIRECT_URL.
export function hasDirectDatabaseTestEnv(): boolean {
  if (process.env.DIRECT_URL) return true;
  return false;
}

export function createDirectComplianceClient() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    throw new Error("DIRECT_URL is required for direct compliance evidence.");
  }

  return postgres(directUrl, { ssl: "require" });
}

// Duplica lib/supabase/admin.ts sem o guard `import "server-only"` — esse
// pacote lança erro fora do bundler do Next.js (só resolve para um módulo
// vazio sob a condição `react-server`), o que quebraria a importação direta
// em testes rodando em Node puro via Vitest.
export function createTestAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function deleteTestAccount(userId: string) {
  const supabase = createTestAdminClient();

  const { error: rpcError } = await supabase.rpc("handle_account_deletion", {
    target: userId,
  });
  if (rpcError) throw rpcError;

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) throw authError;
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

export async function retryAfterJwtClockSkew<
  TResult extends { error: { code?: string; message?: string } | null },
>(operation: () => PromiseLike<TResult>): Promise<TResult> {
  const firstResult = await operation();
  if (
    firstResult.error?.code !== "PGRST303" &&
    !firstResult.error?.message?.includes("JWT issued at future")
  ) {
    return firstResult;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return operation();
}

export async function createConfirmedTestUser(
  prefix: string,
  userMetadata?: Record<string, string>,
) {
  const admin = createTestAdminClient();
  const password = crypto.randomUUID();
  const email = `${prefix}-${crypto.randomUUID()}@example.com`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (error) throw error;

  return { id: data.user.id, email, password };
}

export function createAnonTestClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function createAuthenticatedTestClient(user: { email: string }) {
  const admin = createTestAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error) throw error;

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("test auth: generateLink did not return a token hash");
  }

  const client = createAnonTestClient();
  const { error: verifyError } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (verifyError) throw verifyError;

  return client;
}

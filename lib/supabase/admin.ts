import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente service-role: ignora RLS. Módulo isolado e usado só pela rotina de
// apagamento de conta, via RPC a handle_account_deletion (ver
// db/migrations/0002_account-deletion.sql, cuja execução já é restrita a
// service_role no próprio Postgres). Nunca importar fora de uma rotina admin
// explicitamente auditada — não é o cliente de leitura/escrita comum de
// rotas autenticadas (ver lib/supabase/server.ts).
export function createAdminClient() {
  return createSupabaseClient(
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

export async function deleteAccount(userId: string) {
  const supabase = createAdminClient();

  const { error: rpcError } = await supabase.rpc("handle_account_deletion", {
    target: userId,
  });
  if (rpcError) throw rpcError;

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) throw authError;
}

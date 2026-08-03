import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente autenticado com a sessão do usuário (role `authenticated`, RLS
// ativo). Único caminho para rotas/Server Components lerem ou escreverem
// dado de usuário — nunca uma conexão Drizzle crua (role `postgres`, que
// tem BYPASSRLS e ignoraria as policies silenciosamente).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component sem permissão de
            // escrita em cookies; ignorável se o middleware já renova a
            // sessão nas requisições.
          }
        },
      },
    },
  );
}

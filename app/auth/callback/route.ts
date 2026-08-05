import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Só aceita caminho relativo à própria origem — `next` vem direto da query
// string, então é entrada não confiável. Sem essa checagem, um link como
// /auth/callback?code=...&next=https://evil.com seria um open redirect
// usando nosso domínio pra dar credibilidade a um destino malicioso.
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

// Alvo do link de confirmação/recuperação enviado por e-mail (Supabase usa
// PKCE por padrão: o link do template padrão redireciona pra cá com um
// `code`, não com o token direto). Troca o code por sessão e manda o
// usuário pra próxima tela (workspace novo ou redefinir senha).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

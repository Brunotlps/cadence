import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Só aceita caminho relativo à própria origem — `next` vem direto da query
// string, então é entrada não confiável. Sem essa checagem, um link como
// /auth/callback?...&next=https://evil.com seria um open redirect usando
// nosso domínio pra dar credibilidade a um destino malicioso.
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

// Alvo dos links de confirmação/recuperação enviados por e-mail. Os
// templates padrão do Supabase (decisão 8, emenda registrada na nota de
// execução da decisão 8) foram customizados só na URL — não visualmente —
// pra apontar pra cá com `token_hash`+`type` em vez de `{{ .ConfirmationURL
// }}`: esse último aponta pro endpoint hospedado do próprio Supabase, que
// devolve a sessão no fragmento da URL (fluxo implícito, nunca chega no
// servidor) em vez de um parâmetro de query que dá pra trocar por sessão
// aqui. `token_hash`+`verifyOtp` é o padrão recomendado pela própria
// Supabase pra apps SSR. `code`+`exchangeCodeForSession` fica como caminho
// alternativo pra fluxos OAuth/SSO, que usam PKCE de verdade (fora de
// escopo nesta etapa, mas sem custo manter).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

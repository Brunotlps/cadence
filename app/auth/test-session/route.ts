import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Bypass de login só para a suíte E2E (Etapa 16): não dá pra automatizar a
// tela real de consentimento do Google num navegador de teste. O harness
// continua autenticando um cliente via signInWithPassword — a API do
// Supabase aceita senha normalmente, só a nossa UI parou de expor isso — e
// troca o access/refresh token aqui por uma sessão real no navegador, via a
// mesma escrita de cookie que o SDK usa em produção (`setSession`), em vez
// de montar cookies à mão.
//
// Bloqueada por NODE_ENV, não por uma rota inexistente: `next dev` (usado
// tanto localmente quanto pelo webServer do Playwright em CI) sempre resolve
// para "development"; qualquer deploy real usa `next build`/`next start`
// ("production") e cai no 404 abaixo. Sem segredo adicional — o token só é
// útil pra quem já tem uma sessão válida emitida pelo próprio Supabase, o
// bypass não abre um caminho de autenticação novo, só evita repetir a UI.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const accessToken = body?.accessToken;
  const refreshToken = body?.refreshToken;

  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return NextResponse.json({ error: "missing_tokens" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

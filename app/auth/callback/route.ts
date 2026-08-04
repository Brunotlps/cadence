import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Alvo do link de confirmação/recuperação enviado por e-mail (Supabase usa
// PKCE por padrão: o link do template padrão redireciona pra cá com um
// `code`, não com o token direto). Troca o code por sessão e manda o
// usuário pra próxima tela (workspace novo ou redefinir senha).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

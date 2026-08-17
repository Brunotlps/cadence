import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/navigation/safe-next-path";

// Callback exclusivo do login Google via OAuth/PKCE. Parâmetros legados de
// OTP por e-mail (`token_hash`/`type`) não são aceitos aqui e não criam
// sessão; e-mail/senha deixou de ser método vigente na Etapa 16.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}

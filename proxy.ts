import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Roda em tudo, exceto assets estáticos, imagens e favicon — inclui
    // páginas públicas de auth (login, signup, etc.) porque o middleware
    // também precisa renovar o cookie de sessão nelas, não só redirecionar.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

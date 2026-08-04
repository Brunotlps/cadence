import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Checagem redundante ao middleware — mesmo princípio de "RLS não substitui
// filtro de app" (etapa 04), aplicado a autorização de rota: se um matcher
// mal configurado deixar o middleware não cobrir uma rota nova sob este
// grupo, esta camada ainda bloqueia a renderização de dado sensível
// (etapa 05, decisão 10).
export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}

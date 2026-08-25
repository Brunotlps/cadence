import { redirect } from "next/navigation";
import { loadAuthenticatedProfile } from "@/lib/profiles/load-authenticated-profile";
import { FeedbackDialog } from "@/components/app-shell/feedback-dialog";
import styles from "./layout.module.css";

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
  const profile = await loadAuthenticatedProfile();

  if (profile.status === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className={styles.themeRoot} data-accent={profile.accentColor}>
      {children}
      <FeedbackDialog />
    </div>
  );
}

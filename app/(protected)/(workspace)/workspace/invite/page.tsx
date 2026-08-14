import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { InviteGenerator } from "@/components/workspace/invite-generator";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace/repository";
import styles from "./invite.module.css";

export const metadata: Metadata = {
  title: "Convidar | Cadence",
};

export default async function WorkspaceInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceResult = await getCurrentWorkspace(supabase, user.id);
  if (workspaceResult.error || !workspaceResult.data) {
    redirect("/onboarding/workspace");
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={workspaceResult.data.name}
        title="Convidar alguém"
        description="Gere um link de convite válido por 7 dias e uso único. Compartilhe pelo canal que preferir — quem abrir precisa entrar com o Google e ainda não pode ter um espaço próprio."
      />
      <InviteGenerator />
    </main>
  );
}

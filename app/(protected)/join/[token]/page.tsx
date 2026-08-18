import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinInviteForm } from "./join-invite-form";

export const metadata: Metadata = {
  title: "Convite | Cadence",
};

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;

  return (
    <AuthShell
      eyebrow="Convite"
      title="Confirmar convite"
      description="Confirme para entrar no espaço compartilhado. O convite só será resgatado depois deste envio."
    >
      <JoinInviteForm token={token} />
    </AuthShell>
  );
}

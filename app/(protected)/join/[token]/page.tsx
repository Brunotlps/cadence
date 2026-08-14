import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { redeemWorkspaceInviteAction } from "@/lib/actions/workspace";
import styles from "@/components/auth/auth-shell.module.css";

export const metadata: Metadata = {
  title: "Convite | Cadence",
};

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

const MESSAGES = {
  already_has_workspace: {
    title: "Você já tem um espaço",
    description:
      "Este convite não pode ser usado porque sua conta já participa de um espaço no Cadence.",
  },
  invalid_or_expired: {
    title: "Convite inválido ou expirado",
    description:
      "Peça para quem te convidou gerar um novo link — convites valem por 7 dias e só podem ser usados uma vez.",
  },
  error: {
    title: "Não foi possível confirmar o convite",
    description: "Tente novamente em alguns instantes.",
  },
} as const;

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const result = await redeemWorkspaceInviteAction(token);

  if (result.status === "ok") {
    redirect("/dashboard");
  }

  const { title, description } = MESSAGES[result.status];

  return (
    <AuthShell eyebrow="Convite" title={title} description={description}>
      <Link className={styles.submit} href="/dashboard">
        Ir para o Dashboard
      </Link>
    </AuthShell>
  );
}

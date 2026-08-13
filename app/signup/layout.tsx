import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar conta | Cadence",
  description: "Crie sua conta no Cadence para organizar o mês, metas e contas fixas.",
};

export default function SignUpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

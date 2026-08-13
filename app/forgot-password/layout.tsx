import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recuperar senha | Cadence",
  description: "Solicite a recuperação de senha da sua conta no Cadence.",
};

export default function ForgotPasswordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

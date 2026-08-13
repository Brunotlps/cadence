import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirme seu e-mail | Cadence",
  description: "Confirme seu e-mail para ativar sua conta no Cadence.",
};

export default function ConfirmEmailLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

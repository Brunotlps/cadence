import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redefinir senha | Cadence",
  description: "Defina uma nova senha para sua conta no Cadence.",
};

export default function ResetPasswordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

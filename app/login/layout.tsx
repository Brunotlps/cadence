import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar | Cadence",
  description: "Entre no Cadence para acompanhar seu espaço financeiro.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

import type { Metadata } from "next";
import "./design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence",
  description: "Controle financeiro compartilhado, com privacidade por padrão.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

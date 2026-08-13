import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crie seu espaço | Cadence",
  description: "Crie o espaço onde lançamentos, metas e contas fixas ficam organizados.",
};

export default function CreateWorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

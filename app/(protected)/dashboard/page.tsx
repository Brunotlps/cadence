import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/actions/auth";

// MVP: um workspace por usuário (sem convites/múltiplos membros ainda — ver
// "Fora de escopo" em CLAUDE.md), então a primeira membership do usuário
// já é o único espaço dele. Sem membership, o onboarding (subtarefa 8) ainda
// não rodou.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspaces(name)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/workspace");
  }

  const workspaceName = (
    membership.workspaces as unknown as { name: string } | null
  )?.name;

  return (
    <main>
      <h1>{workspaceName}</h1>
      <form action={signOutAction}>
        <button type="submit">Sair</button>
      </form>
    </main>
  );
}

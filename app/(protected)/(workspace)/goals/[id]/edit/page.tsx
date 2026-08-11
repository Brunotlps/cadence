import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoalForm } from "@/components/goals/goal-form";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { updateGoalAction } from "@/lib/actions/goals";
import { loadGoalForEdit } from "@/lib/goals/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

export const metadata: Metadata = {
  title: "Editar meta | Cadence",
};

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const result = await loadGoalForEdit(supabase, user.id, id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <FeedbackState
          kind="error"
          title="Não foi possível carregar esta meta."
          description="O registro pode não estar disponível."
        >
          <Link href="/goals">Voltar às metas</Link>
        </FeedbackState>
      </main>
    );
  }

  const action = updateGoalAction.bind(null, result.data.goal.id);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={result.data.workspace.name}
        title="Editar meta"
        description="Atualize o objetivo ou o ritmo sem alterar os aportes registrados."
      />
      <section className={styles.card} aria-label="Dados da meta">
        <GoalForm
          action={action}
          redirectOnSuccess="/goals"
          submitLabel="Salvar alterações"
          initialValues={{
            name: result.data.goal.name,
            targetAmount: numericToAmountInput(result.data.goal.targetAmount),
            suggestedMonthly: result.data.goal.suggestedMonthly
              ? numericToAmountInput(result.data.goal.suggestedMonthly)
              : "",
          }}
        />
        <footer className={styles.footer}>
          <Link href="/goals">Cancelar</Link>
        </footer>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ContributionForm } from "@/components/goals/contribution-form";
import { DeleteContribution } from "@/components/goals/delete-contribution";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { updateContributionAction } from "@/lib/actions/goals";
import { loadContributionForEdit } from "@/lib/goals/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

export const metadata: Metadata = {
  title: "Editar aporte | Cadence",
};

export default async function EditContributionPage({
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
  const result = await loadContributionForEdit(supabase, user.id, id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <FeedbackState
          kind="error"
          title="Não foi possível carregar este aporte."
          description="O registro pode não estar disponível."
        >
          <Link href="/goals">Voltar às metas</Link>
        </FeedbackState>
      </main>
    );
  }

  const action = updateContributionAction.bind(
    null,
    result.data.contribution.id,
  );

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={result.data.workspace.name}
        title="Editar aporte"
        description="Corrija o valor, a data ou a meta vinculada."
      />
      <section className={styles.card} aria-label="Dados do aporte">
        <ContributionForm
          action={action}
          idPrefix="edit-contribution"
          redirectOnSuccess="/goals"
          submitLabel="Salvar alterações"
          goals={result.data.goals}
          initialValues={{
            amount: numericToAmountInput(result.data.contribution.amount),
            occurredOn: result.data.contribution.occurredOn,
            goalId: result.data.contribution.goalId ?? "",
          }}
        />
        <footer className={styles.footer}>
          <DeleteContribution
            transactionId={result.data.contribution.id}
            redirectOnSuccess="/goals"
          />
          <Link href="/goals">Cancelar</Link>
        </footer>
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ContributionForm } from "@/components/goals/contribution-form";
import { DeleteContribution } from "@/components/goals/delete-contribution";
import { updateContributionAction } from "@/lib/actions/goals";
import { loadContributionForEdit } from "@/lib/goals/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

export default async function EditContributionPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const result = await loadContributionForEdit(supabase, user.id, id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") return <main className={styles.errorPage}><div className={styles.errorCard}><h1>Editar aporte</h1><p role="alert">Não foi possível carregar este aporte.</p><Link href="/goals">Voltar às metas</Link></div></main>;
  const action = updateContributionAction.bind(null, result.data.contribution.id);
  return <main className={styles.page}><header className={styles.header}><p className={styles.workspace}>{result.data.workspace.name}</p><h1>Editar aporte</h1></header><section className={styles.card}><ContributionForm action={action} idPrefix="edit-contribution" redirectOnSuccess="/goals" submitLabel="Salvar alterações" goals={result.data.goals} initialValues={{ amount: numericToAmountInput(result.data.contribution.amount), occurredOn: result.data.contribution.occurredOn, goalId: result.data.contribution.goalId ?? "" }} /><footer className={styles.footer}><DeleteContribution transactionId={result.data.contribution.id} /><Link href="/goals">Cancelar</Link></footer></section></main>;
}

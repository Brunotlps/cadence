import Link from "next/link";
import { redirect } from "next/navigation";
import { GoalForm } from "@/components/goals/goal-form";
import { updateGoalAction } from "@/lib/actions/goals";
import { loadGoalForEdit } from "@/lib/goals/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const result = await loadGoalForEdit(supabase, user.id, id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") return <main className={styles.errorPage}><div className={styles.errorCard}><h1>Editar meta</h1><p role="alert">Não foi possível carregar esta meta.</p><Link href="/goals">Voltar às metas</Link></div></main>;
  const action = updateGoalAction.bind(null, result.data.goal.id);
  return <main className={styles.page}><header className={styles.header}><p className={styles.workspace}>{result.data.workspace.name}</p><h1>Editar meta</h1></header><section className={styles.card}><GoalForm action={action} redirectOnSuccess="/goals" submitLabel="Salvar alterações" initialValues={{ name: result.data.goal.name, targetAmount: numericToAmountInput(result.data.goal.targetAmount), suggestedMonthly: result.data.goal.suggestedMonthly ? numericToAmountInput(result.data.goal.suggestedMonthly) : "" }} /><footer className={styles.footer}><Link href="/goals">Cancelar</Link></footer></section></main>;
}

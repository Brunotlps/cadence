import Link from "next/link";
import { redirect } from "next/navigation";
import { updateTransactionAction } from "@/lib/actions/transactions";
import { DeleteTransaction } from "@/components/transactions/delete-transaction";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { createClient } from "@/lib/supabase/server";
import { resolveMonth } from "@/lib/transactions/civil-date";
import { loadTransactionForEdit } from "@/lib/transactions/load-edit";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "./edit.module.css";

type EditTransactionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function EditTransactionPage({
  params,
  searchParams,
}: EditTransactionPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ id }, { month: monthValue }] = await Promise.all([
    params,
    searchParams,
  ]);
  const month = resolveMonth(monthValue);
  const result = await loadTransactionForEdit(supabase, user.id, id);

  if (result.status === "no_workspace") redirect("/onboarding/workspace");

  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <div className={styles.errorCard}>
          <h1>Editar lançamento</h1>
          <p role="alert">Não foi possível carregar este lançamento.</p>
          <Link href={`/dashboard?month=${month}`}>Voltar ao Dashboard</Link>
        </div>
      </main>
    );
  }

  const { transaction, workspace } = result.data;
  const updateAction = updateTransactionAction.bind(null, transaction.id);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.workspace}>{workspace.name}</p>
        <h1>Editar lançamento</h1>
      </header>
      <section className={styles.card} aria-label="Dados do lançamento">
        <TransactionForm
          action={updateAction}
          month={month}
          submitLabel="Salvar alterações"
          initialValues={{
            amount: numericToAmountInput(transaction.amount),
            category: transaction.category ?? "",
            occurredOn: transaction.occurredOn,
            description: transaction.description ?? "",
            paymentMethod: transaction.paymentMethod ?? "",
          }}
        />
        <footer className={styles.footer}>
          <DeleteTransaction
            transactionId={transaction.id}
            returnMonth={month}
          />
          <Link href={`/dashboard?month=${month}`}>Cancelar</Link>
        </footer>
      </section>
    </main>
  );
}

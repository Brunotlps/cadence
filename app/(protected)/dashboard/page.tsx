import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCivilDatePtBR,
  formatCurrencyBRL,
  formatMonthPtBR,
} from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/actions/auth";
import { createTransactionAction } from "@/lib/actions/transactions";
import { DeleteTransaction } from "@/components/transactions/delete-transaction";
import { DeleteContribution } from "@/components/goals/delete-contribution";
import { ExpenseDonut } from "@/components/transactions/expense-donut";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TRANSACTION_CATEGORIES } from "@/lib/transactions/categories";
import {
  getTodayInSaoPaulo,
  shiftMonth,
} from "@/lib/transactions/civil-date";
import { loadTransactionDashboard } from "@/lib/transactions/load-dashboard";
import { parseAmountToCents } from "@/lib/transactions/money";
import { PAYMENT_METHODS } from "@/lib/transactions/payment-methods";
import type { TransactionRecord } from "@/lib/transactions/repository";
import styles from "./dashboard.module.css";

type DashboardPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

function categoryLabel(transaction: TransactionRecord): string {
  if (transaction.kind === "contribution") {
    return transaction.goalId ? "Aporte" : "Aporte de meta excluída";
  }
  return (
    TRANSACTION_CATEGORIES.find(
      (category) => category.code === transaction.category,
    )?.label ?? "Lançamento"
  );
}

function paymentMethodLabel(transaction: TransactionRecord): string | null {
  if (!transaction.paymentMethod) return null;
  return (
    PAYMENT_METHODS.find(
      (paymentMethod) => paymentMethod.code === transaction.paymentMethod,
    )?.label ?? null
  );
}

function signedAmount(transaction: TransactionRecord): string {
  const amountCents = parseAmountToCents(transaction.amount);
  if (amountCents === null) throw new TypeError("invalid transaction amount");

  return formatCurrencyBRL(
    transaction.kind === "income" ? amountCents : -amountCents,
  );
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { month } = await searchParams;
  const result = await loadTransactionDashboard(supabase, user.id, month);

  if (result.status === "no_workspace") redirect("/onboarding/workspace");

  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <div className={styles.errorCard}>
          <h1>Dashboard</h1>
          <p role="alert">
            Não foi possível carregar seus lançamentos. Tente novamente.
          </p>
          <form action={signOutAction}>
            <button className={styles.logout} type="submit">
              Sair
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { data } = result;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <p className={styles.eyebrow}>Cadence</p>
          <h1>{data.workspace.name}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link href="/goals">Metas</Link>
          <form action={signOutAction}>
            <button className={styles.logout} type="submit">Sair</button>
          </form>
        </div>
      </header>

      <nav className={styles.monthNav} aria-label="Navegação por mês">
        <Link href={`/dashboard?month=${shiftMonth(data.month, -1)}`}>
          Mês anterior
        </Link>
        <h2>{formatMonthPtBR(data.month)}</h2>
        <Link href={`/dashboard?month=${shiftMonth(data.month, 1)}`}>
          Próximo mês
        </Link>
      </nav>

      <div className={styles.topGrid}>
        <section
          className={styles.card}
          aria-labelledby="new-transaction-title"
        >
          <h2 className={styles.cardTitle} id="new-transaction-title">
            Novo lançamento
          </h2>
          <TransactionForm
            action={createTransactionAction}
            month={data.month}
            submitLabel="Salvar lançamento"
            initialValues={{
              amount: "",
              category: "",
              occurredOn: getTodayInSaoPaulo(),
              description: "",
              paymentMethod: "",
            }}
          />
        </section>

        <div className={styles.insights}>
          <section
            className={`${styles.card} ${styles.summary}`}
            aria-label="Resumo do mês"
          >
            <p className={styles.balanceLabel}>Saldo do mês</p>
            <p className={styles.balance}>
              {formatCurrencyBRL(data.summary.balanceCents)}
            </p>
            <dl>
              <div>
                <dt>Receitas</dt>
                <dd>{formatCurrencyBRL(data.summary.incomeCents)}</dd>
              </div>
              <div>
                <dt>Despesas</dt>
                <dd>{formatCurrencyBRL(data.summary.expenseCents)}</dd>
              </div>
              {data.summary.contributionCents > 0 && (
                <div>
                  <dt>Aportes</dt>
                  <dd>{formatCurrencyBRL(data.summary.contributionCents)}</dd>
                </div>
              )}
            </dl>
          </section>

          <ExpenseDonut data={data.summary.expensesByCategory} />
        </div>
      </div>

      <section
        className={`${styles.card} ${styles.transactions}`}
        aria-labelledby="transactions-title"
      >
        <div className={styles.sectionHeader}>
          <h2 id="transactions-title">Lançamentos do mês</h2>
          <span>{data.transactions.length} no período</span>
        </div>
        {data.transactions.length === 0 ? (
          data.isWorkspaceEmpty ? (
            <div className={styles.emptyState}>
              <p>Nenhum lançamento neste mês.</p>
              <p>
                Nenhum lançamento ainda. Registre sua primeira receita ou despesa
                para começar a acompanhar o mês.
              </p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Nenhum lançamento neste mês.</p>
            </div>
          )
        ) : (
          <ul className={styles.transactionList}>
            {data.transactions.map((transaction) => {
              const category = categoryLabel(transaction);
              const paymentMethod = paymentMethodLabel(transaction);

              return (
                <li key={transaction.id}>
                  <article className={styles.transactionRow}>
                    <div>
                      <h3>{transaction.description ?? category}</h3>
                      <div className={styles.metadata}>
                        <span>{category}</span>
                        <span>{formatCivilDatePtBR(transaction.occurredOn)}</span>
                        {paymentMethod && <span>{paymentMethod}</span>}
                      </div>
                    </div>
                    <p
                      className={`${styles.amount} ${
                        transaction.kind === "income"
                          ? styles.income
                          : styles.outflow
                      }`}
                    >
                      {signedAmount(transaction)}
                    </p>
                    {transaction.kind !== "contribution" ? (
                      <div className={styles.rowActions}>
                        <Link
                          href={`/transactions/${transaction.id}/edit?month=${data.month}`}
                        >
                          Editar
                        </Link>
                        <DeleteTransaction transactionId={transaction.id} />
                      </div>
                    ) : (
                      <div className={styles.rowActions}>
                        <Link href={`/contributions/${transaction.id}/edit`}>Editar</Link>
                        <DeleteContribution transactionId={transaction.id} dashboardLabel />
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

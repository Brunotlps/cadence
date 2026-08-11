import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCivilDatePtBR,
  formatCurrencyBRL,
  formatMonthPtBR,
} from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";
import { createTransactionAction } from "@/lib/actions/transactions";
import { DeleteTransaction } from "@/components/transactions/delete-transaction";
import { DeleteContribution } from "@/components/goals/delete-contribution";
import { DeleteBillPayment } from "@/components/fixed-bills/delete-bill-payment";
import { ExpenseDonut } from "@/components/transactions/expense-donut";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { FeedbackState } from "@/components/ui/feedback-state";
import { MonthNavigation } from "@/components/ui/month-navigation";
import { PageHeader } from "@/components/ui/page-header";
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

export const metadata: Metadata = {
  title: "Dashboard | Cadence",
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
        <FeedbackState
          kind="error"
          title="Não foi possível carregar seus lançamentos."
          description="Tente novamente em alguns instantes."
        />
      </main>
    );
  }

  const { data } = result;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Dashboard"
        title={data.workspace.name}
        description="Registre o que entrou e saiu e acompanhe o resultado do mês."
      />

      <MonthNavigation
        label={formatMonthPtBR(data.month)}
        previousHref={`/dashboard?month=${shiftMonth(data.month, -1)}`}
        nextHref={`/dashboard?month=${shiftMonth(data.month, 1)}`}
      />

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
            submitLabel="Registrar lançamento"
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
            <FeedbackState
              kind="empty"
              headingLevel={3}
              title="Nenhum lançamento neste mês."
              description="Registre sua primeira receita ou despesa para começar a acompanhar o mês."
            />
          ) : (
            <FeedbackState
              kind="empty"
              headingLevel={3}
              title="Nenhum lançamento neste mês."
              description="Use a navegação acima para consultar outro período."
            />
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
                        {transaction.fixedBillId && (
                          <span className={styles.fixedBillBadge}>Conta fixa</span>
                        )}
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
                    {transaction.kind === "contribution" ? (
                      <div className={styles.rowActions}>
                        <Link href={`/contributions/${transaction.id}/edit`}>Editar</Link>
                        <DeleteContribution transactionId={transaction.id} dashboardLabel />
                      </div>
                    ) : transaction.fixedBillId ? (
                      <div className={styles.rowActions}>
                        <Link href={`/bill-payments/${transaction.id}/edit`}>Editar</Link>
                        <DeleteBillPayment transactionId={transaction.id} dashboardLabel />
                      </div>
                    ) : (
                      <div className={styles.rowActions}>
                        <Link
                          href={`/transactions/${transaction.id}/edit?month=${data.month}`}
                        >
                          Editar
                        </Link>
                        <DeleteTransaction transactionId={transaction.id} />
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

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatCivilDatePtBR,
  formatCurrencyBRL,
  formatMonthPtBR,
} from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/actions/auth";
import { TRANSACTION_CATEGORIES } from "@/lib/transactions/categories";
import { shiftMonth } from "@/lib/transactions/civil-date";
import { loadTransactionDashboard } from "@/lib/transactions/load-dashboard";
import { parseAmountToCents } from "@/lib/transactions/money";
import { PAYMENT_METHODS } from "@/lib/transactions/payment-methods";
import type { TransactionRecord } from "@/lib/transactions/repository";

type DashboardPageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

function categoryLabel(transaction: TransactionRecord): string {
  if (transaction.kind === "contribution") return "Aporte";
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
      <main>
        <h1>Dashboard</h1>
        <p role="alert">
          Não foi possível carregar seus lançamentos. Tente novamente.
        </p>
        <form action={signOutAction}>
          <button type="submit">Sair</button>
        </form>
      </main>
    );
  }

  const { data } = result;

  return (
    <main>
      <header>
        <h1>{data.workspace.name}</h1>
        <form action={signOutAction}>
          <button type="submit">Sair</button>
        </form>
      </header>

      <nav aria-label="Navegação por mês">
        <Link href={`/dashboard?month=${shiftMonth(data.month, -1)}`}>
          Mês anterior
        </Link>
        <h2>{formatMonthPtBR(data.month)}</h2>
        <Link href={`/dashboard?month=${shiftMonth(data.month, 1)}`}>
          Próximo mês
        </Link>
      </nav>

      <section aria-label="Resumo do mês">
        <h2>Saldo do mês</h2>
        <p>{formatCurrencyBRL(data.summary.balanceCents)}</p>
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

      <section aria-labelledby="category-summary-title">
        <h2 id="category-summary-title">Despesas por categoria</h2>
        {data.summary.expensesByCategory.length === 0 ? (
          <p>Sem despesas neste mês.</p>
        ) : (
          <ul>
            {data.summary.expensesByCategory.map((item) => (
              <li key={item.category}>
                <span>
                  {
                    TRANSACTION_CATEGORIES.find(
                      (category) => category.code === item.category,
                    )?.label
                  }
                </span>{" "}
                <span>{formatCurrencyBRL(item.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="transactions-title">
        <h2 id="transactions-title">Lançamentos do mês</h2>
        {data.transactions.length === 0 ? (
          <p>
            {data.isWorkspaceEmpty
              ? "Nenhum lançamento ainda. Registre sua primeira receita ou despesa para começar a acompanhar o mês."
              : "Nenhum lançamento neste mês."}
          </p>
        ) : (
          <ul>
            {data.transactions.map((transaction) => {
              const category = categoryLabel(transaction);
              const paymentMethod = paymentMethodLabel(transaction);

              return (
                <li key={transaction.id}>
                  <article>
                    <h3>{transaction.description ?? category}</h3>
                    <p>{category}</p>
                    <p>{formatCivilDatePtBR(transaction.occurredOn)}</p>
                    {paymentMethod && <p>{paymentMethod}</p>}
                    <p>{signedAmount(transaction)}</p>
                    {transaction.kind !== "contribution" && (
                      <Link
                        href={`/transactions/${transaction.id}/edit?month=${data.month}`}
                      >
                        Editar
                      </Link>
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

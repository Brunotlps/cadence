import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillPaymentForm } from "@/components/fixed-bills/bill-payment-form";
import { DeleteBillPayment } from "@/components/fixed-bills/delete-bill-payment";
import { DeleteFixedBill } from "@/components/fixed-bills/delete-fixed-bill";
import { FixedBillForm } from "@/components/fixed-bills/fixed-bill-form";
import { RevealPanel } from "@/components/ui/reveal-panel";
import { FeedbackState } from "@/components/ui/feedback-state";
import { MonthNavigation } from "@/components/ui/month-navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  createBillPaymentAction,
  createFixedBillAction,
} from "@/lib/actions/fixed-bills";
import {
  formatCurrencyBRL,
  formatMonthPtBR,
} from "@/lib/formatters";
import type {
  FixedBillDashboardItem,
  FixedBillFilter,
} from "@/lib/fixed-bills/load-dashboard";
import { loadFixedBillsDashboard } from "@/lib/fixed-bills/load-dashboard";
import { createClient } from "@/lib/supabase/server";
import { TRANSACTION_CATEGORIES } from "@/lib/transactions/categories";
import { shiftMonth } from "@/lib/transactions/civil-date";
import {
  numericToAmountInput,
  parseAmountToCents,
} from "@/lib/transactions/money";
import styles from "./fixed-bills.module.css";

type FixedBillsPageProps = {
  searchParams: Promise<{
    month?: string | string[];
    filter?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Contas fixas | Cadence",
};

const filters: Array<{ value: FixedBillFilter; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "pendentes", label: "Pendentes" },
  { value: "pagas", label: "Pagas" },
  { value: "automaticas", label: "Automáticas" },
];

function filterHref(month: string, filter: FixedBillFilter): string {
  return `/fixed-bills?month=${month}&filter=${filter}`;
}

function monthHref(month: string, filter: FixedBillFilter): string {
  return `/fixed-bills?month=${month}&filter=${filter}`;
}

function statusLabel(status: FixedBillDashboardItem["status"]): string {
  switch (status) {
    case "paid":
      return "Pago";
    case "due_soon":
      return "Vence em breve";
    case "overdue":
      return "Em atraso";
    case "pending":
      return "Pendente";
    case "not_recorded":
      return "Não registrado";
  }
}

function categoryLabel(bill: FixedBillDashboardItem): string {
  return (
    TRANSACTION_CATEGORIES.find((category) => category.code === bill.category)
      ?.label ?? "Despesa"
  );
}

function statusBadgeClass(bill: FixedBillDashboardItem): string {
  if (bill.status === "paid") return styles.paidBadge;
  if (bill.status === "overdue") return styles.overdueBadge;
  return "";
}

function billClassName(bill: FixedBillDashboardItem): string {
  if (bill.status === "due_soon") return `${styles.bill} ${styles.billDueSoon}`;
  if (bill.status === "overdue") return `${styles.bill} ${styles.billOverdue}`;
  return styles.bill;
}

export default async function FixedBillsPage({
  searchParams,
}: FixedBillsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { month, filter } = await searchParams;
  const result = await loadFixedBillsDashboard(
    supabase,
    user.id,
    month,
    filter,
  );

  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <FeedbackState
          kind="error"
          title="Não foi possível carregar suas contas fixas."
          description="Tente novamente em alguns instantes."
        >
          <Link href="/dashboard">Voltar ao Dashboard</Link>
        </FeedbackState>
      </main>
    );
  }

  const { data } = result;

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={data.workspace.name}
        title="Contas fixas"
        description="Compare o previsto com o que foi pago em cada mês."
      />

      <MonthNavigation
        label={formatMonthPtBR(data.month)}
        previousHref={monthHref(shiftMonth(data.month, -1), data.filter)}
        nextHref={monthHref(shiftMonth(data.month, 1), data.filter)}
      />

      <nav className={styles.filterNav} aria-label="Filtrar contas fixas">
        {filters.map((item) => (
          <Link
            key={item.value}
            href={filterHref(data.month, item.value)}
            aria-current={data.filter === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <RevealPanel
        className={`${styles.card} ${styles.create}`}
        label="Nova conta fixa"
      >
        <FixedBillForm
          action={createFixedBillAction}
          submitLabel="Salvar conta fixa"
          initialValues={{
            name: "",
            dueDay: "",
            category: "",
            estimatedAmount: "",
            autopay: false,
            variableAmount: false,
          }}
        />
      </RevealPanel>

      {data.totalBillCount === 0 ? (
        <FeedbackState
          kind="empty"
          title="Nenhuma conta fixa ainda."
          description="Cadastre uma recorrência para comparar o previsto com os pagamentos do mês."
        />
      ) : data.bills.length === 0 ? (
        <FeedbackState
          kind="empty"
          title="Nenhuma conta fixa neste filtro."
          description="Escolha outra situação para ver as demais contas."
        />
      ) : (
        <section className={styles.grid} aria-label="Contas fixas">
          {data.bills.map((bill) => {
            const paymentAction = createBillPaymentAction.bind(null, bill.id);
            const paymentDate =
              data.month === data.today.slice(0, 7) ? data.today : bill.dueOn;

            return (
              <article
                key={bill.id}
                className={billClassName(bill)}
                aria-label={bill.name}
              >
                <div className={styles.billHeader}>
                  <h2>{bill.name}</h2>
                  <div className={styles.badges}>
                    {bill.status === "paid" ? (
                      <span
                        className={`${styles.badge} ${styles.paidBadge}`}
                        data-status="paid"
                      >
                        Pago
                      </span>
                    ) : (
                      <span
                        className={`${styles.badge} ${statusBadgeClass(bill)}`}
                        data-status={bill.status}
                      >
                        {statusLabel(bill.status)}
                      </span>
                    )}
                    {bill.autopay && (
                      <span className={styles.autopayBadge}>
                        Débito automático
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.metadata}>
                  <p>{categoryLabel(bill)}</p>
                  <p>Vence dia {Number(bill.dueOn.slice(8, 10))}</p>
                </div>

                <div className={styles.amounts}>
                  <p className={styles.estimate}>
                    {bill.variableAmount ? "≈ " : ""}
                    {formatCurrencyBRL(bill.estimatedCents)} previsto
                  </p>
                  {bill.paymentCount > 0 && (
                    <p className={styles.paidAmount}>
                      {formatCurrencyBRL(bill.paidCents)} pago
                      {bill.paymentCount > 1
                        ? ` em ${bill.paymentCount} pagamentos`
                        : ""}
                    </p>
                  )}
                </div>

                <div className={styles.actions}>
                  <Link href={`/fixed-bills/${bill.id}/edit`}>
                    Editar conta
                  </Link>
                  <DeleteFixedBill
                    fixedBillId={bill.id}
                    paymentCount={bill.linkedPaymentCount}
                  />
                </div>

                <RevealPanel
                  className={styles.paymentForm}
                  label="Confirmar pagamento"
                >
                  <BillPaymentForm
                    action={paymentAction}
                    idPrefix={`bill-payment-${bill.id}`}
                    submitLabel="Salvar pagamento"
                    initialValues={{
                      amount: numericToAmountInput(bill.estimatedAmount),
                      occurredOn: paymentDate,
                      paymentMethod: "",
                      fixedBillId: bill.id,
                    }}
                  />
                </RevealPanel>

                {bill.payments.length > 0 && (
                  <section className={styles.payments}>
                    <h3>Pagamentos do mês</h3>
                    <ul>
                      {bill.payments.map((payment) => (
                        <li className={styles.paymentRow} key={payment.id}>
                          <span>
                            {formatCurrencyBRL(
                              parseAmountToCents(payment.amount) ?? 0,
                            )}
                          </span>
                          <Link href={`/bill-payments/${payment.id}/edit`}>
                            Editar pagamento
                          </Link>
                          <DeleteBillPayment transactionId={payment.id} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

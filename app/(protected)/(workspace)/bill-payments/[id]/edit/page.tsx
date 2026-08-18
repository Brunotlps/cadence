import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillPaymentForm } from "@/components/fixed-bills/bill-payment-form";
import { DeleteBillPayment } from "@/components/fixed-bills/delete-bill-payment";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { updateBillPaymentAction } from "@/lib/actions/fixed-bills";
import { loadBillPaymentForEdit } from "@/lib/fixed-bills/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

export const metadata: Metadata = {
  title: "Editar pagamento | Cadence",
};

export default async function EditBillPaymentPage({
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
  const result = await loadBillPaymentForEdit(supabase, user.id, id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <FeedbackState
          kind="error"
          title="Não foi possível carregar este pagamento."
          description="O registro pode não estar disponível."
        >
          <Link href="/fixed-bills">Voltar às contas fixas</Link>
        </FeedbackState>
      </main>
    );
  }

  const { payment, fixedBills, workspace } = result.data;
  const action = updateBillPaymentAction.bind(null, payment.id);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={workspace.name}
        title="Editar pagamento"
        description="Corrija o valor, a data, a forma de pagamento ou a conta vinculada."
      />
      <section className={styles.card} aria-label="Dados do pagamento">
        <BillPaymentForm
          action={action}
          idPrefix="edit-bill-payment"
          redirectOnSuccess="/fixed-bills"
          submitLabel="Salvar alterações"
          fixedBills={fixedBills}
          initialValues={{
            amount: numericToAmountInput(payment.amount),
            occurredOn: payment.occurredOn,
            paymentMethod: payment.paymentMethod ?? "",
            fixedBillId: payment.fixedBillId,
          }}
        />
        <footer className={styles.footer}>
          <DeleteBillPayment
            transactionId={payment.id}
            redirectOnSuccess="/fixed-bills"
          />
          <Link href="/fixed-bills">Cancelar</Link>
        </footer>
      </section>
    </main>
  );
}

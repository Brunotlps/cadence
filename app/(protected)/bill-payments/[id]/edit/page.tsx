import Link from "next/link";
import { redirect } from "next/navigation";
import { BillPaymentForm } from "@/components/fixed-bills/bill-payment-form";
import { DeleteBillPayment } from "@/components/fixed-bills/delete-bill-payment";
import { updateBillPaymentAction } from "@/lib/actions/fixed-bills";
import { loadBillPaymentForEdit } from "@/lib/fixed-bills/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

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
        <div className={styles.errorCard}>
          <h1>Editar pagamento</h1>
          <p role="alert">Não foi possível carregar este pagamento.</p>
          <Link href="/fixed-bills">Voltar às contas fixas</Link>
        </div>
      </main>
    );
  }

  const { payment, fixedBills, workspace } = result.data;
  const action = updateBillPaymentAction.bind(null, payment.id);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.workspace}>{workspace.name}</p>
        <h1>Editar pagamento</h1>
      </header>
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
          <DeleteBillPayment transactionId={payment.id} />
          <Link href="/fixed-bills">Cancelar</Link>
        </footer>
      </section>
    </main>
  );
}

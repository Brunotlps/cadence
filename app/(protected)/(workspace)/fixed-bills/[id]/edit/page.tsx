import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FixedBillForm } from "@/components/fixed-bills/fixed-bill-form";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { updateFixedBillAction } from "@/lib/actions/fixed-bills";
import { loadFixedBillForEdit } from "@/lib/fixed-bills/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

export const metadata: Metadata = {
  title: "Editar conta fixa | Cadence",
};

export default async function EditFixedBillPage({
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
  const result = await loadFixedBillForEdit(supabase, user.id, id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <FeedbackState
          kind="error"
          title="Não foi possível carregar esta conta fixa."
          description="O registro pode não estar disponível."
        >
          <Link href="/fixed-bills">Voltar às contas fixas</Link>
        </FeedbackState>
      </main>
    );
  }

  const { fixedBill, workspace } = result.data;
  const action = updateFixedBillAction.bind(null, fixedBill.id);

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={workspace.name}
        title="Editar conta fixa"
        description="Ajuste a recorrência sem reescrever os pagamentos anteriores."
      />
      <section className={styles.card} aria-label="Dados da conta fixa">
        <FixedBillForm
          action={action}
          redirectOnSuccess="/fixed-bills"
          submitLabel="Salvar alterações"
          initialValues={{
            name: fixedBill.name,
            dueDay: String(fixedBill.dueDay),
            category: fixedBill.category,
            estimatedAmount: numericToAmountInput(fixedBill.estimatedAmount),
            autopay: fixedBill.autopay,
            variableAmount: fixedBill.variableAmount,
          }}
        />
        <p className={styles.notice}>
          Alterar a categoria afeta apenas pagamentos futuros; lançamentos já
          registrados mantêm a categoria original.
        </p>
        <footer className={styles.footer}>
          <Link href="/fixed-bills">Cancelar</Link>
        </footer>
      </section>
    </main>
  );
}

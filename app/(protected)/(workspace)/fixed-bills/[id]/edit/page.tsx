import Link from "next/link";
import { redirect } from "next/navigation";
import { FixedBillForm } from "@/components/fixed-bills/fixed-bill-form";
import { updateFixedBillAction } from "@/lib/actions/fixed-bills";
import { loadFixedBillForEdit } from "@/lib/fixed-bills/load-edit";
import { createClient } from "@/lib/supabase/server";
import { numericToAmountInput } from "@/lib/transactions/money";
import styles from "../../../transactions/[id]/edit/edit.module.css";

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
        <div className={styles.errorCard}>
          <h1>Editar conta fixa</h1>
          <p role="alert">Não foi possível carregar esta conta fixa.</p>
          <Link href="/fixed-bills">Voltar às contas fixas</Link>
        </div>
      </main>
    );
  }

  const { fixedBill, workspace } = result.data;
  const action = updateFixedBillAction.bind(null, fixedBill.id);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.workspace}>{workspace.name}</p>
        <h1>Editar conta fixa</h1>
      </header>
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
        <p>
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

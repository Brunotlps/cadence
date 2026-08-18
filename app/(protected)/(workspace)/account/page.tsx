import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteAccountForm } from "./delete-account-form";
import styles from "./account.module.css";

export const metadata: Metadata = {
  title: "Conta | Cadence",
};

export default function AccountPage() {
  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Conta"
        title="Conta"
        description="Gerencie o ciclo de vida da sua conta no Cadence."
      />

      <section className={styles.exportZone} aria-labelledby="export-data">
        <div className={styles.exportCopy}>
          <p className={styles.sectionLabel}>Portabilidade</p>
          <h2 id="export-data">Exportar meus dados</h2>
          <p>
            Baixe um arquivo JSON com os dados que você pode acessar no Cadence.
          </p>
        </div>
        <Link className={styles.exportButton} href="/account/export">
          Baixar meus dados
        </Link>
      </section>

      <section className={styles.dangerZone} aria-labelledby="delete-account">
        <div className={styles.dangerCopy}>
          <p className={styles.sectionLabel}>Ação irreversível</p>
          <h2 id="delete-account">Excluir conta</h2>
          <p>
            Remove seu perfil, suas participações e os espaços que ficarem sem
            membros. Para confirmar, digite <strong>EXCLUIR</strong>.
          </p>
        </div>
        <DeleteAccountForm />
      </section>
    </main>
  );
}

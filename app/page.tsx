import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.brandMark} aria-hidden="true" />
        <h1>Cadence</h1>
        <p className={styles.promise}>Seu dinheiro, no seu ritmo.</p>
        <p className={styles.description}>
          Uma visão clara do mês, das metas e das contas que se repetem.
        </p>

        <ul className={styles.productAreas} aria-label="Áreas do Cadence">
          <li>Dashboard</li>
          <li>Metas</li>
          <li>Contas fixas</li>
        </ul>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/login">
            Entrar com Google
          </Link>
        </div>

        <p className={styles.privacy}>
          Privacidade por padrão · sem rastreamento comportamental.
        </p>
      </section>
    </main>
  );
}

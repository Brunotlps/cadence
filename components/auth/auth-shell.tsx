import type { ReactNode } from "react";
import styles from "./auth-shell.module.css";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="account-flow-title">
        <p className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span>Cadence</span>
        </p>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id="account-flow-title">{title}</h1>
          <p className={styles.description}>{description}</p>
        </header>
        {children}
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </section>
    </main>
  );
}

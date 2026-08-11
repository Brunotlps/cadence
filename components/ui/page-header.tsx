import type { ReactNode } from "react";
import styles from "./page-patterns.module.css";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeading}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {children && <div className={styles.headerActions}>{children}</div>}
    </header>
  );
}

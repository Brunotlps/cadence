import Link from "next/link";
import styles from "./page-patterns.module.css";

type MonthNavigationProps = {
  label: string;
  previousHref: string;
  nextHref: string;
};

export function MonthNavigation({
  label,
  previousHref,
  nextHref,
}: MonthNavigationProps) {
  return (
    <nav className={styles.monthNavigation} aria-label="Navegação por mês">
      <Link href={previousHref} aria-label="Mês anterior">
        Anterior
      </Link>
      <h2>{label}</h2>
      <Link href={nextHref} aria-label="Próximo mês">
        Próximo
      </Link>
    </nav>
  );
}

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
      <Link href={previousHref}>Mês anterior</Link>
      <h2>{label}</h2>
      <Link href={nextHref}>Próximo mês</Link>
    </nav>
  );
}

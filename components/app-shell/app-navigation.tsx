"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_DESTINATIONS,
  getActiveAppDestination,
} from "@/lib/navigation/routes";
import styles from "./app-shell.module.css";

export function AppNavigation({ className = "" }: { className?: string }) {
  const activeDestination = getActiveAppDestination(usePathname());

  return (
    <nav
      className={`${styles.navigation} ${className}`}
      aria-label="Navegação principal"
    >
      {APP_DESTINATIONS.map((destination) => (
        <Link
          className={styles.navLink}
          href={destination.href}
          key={destination.id}
          aria-current={
            activeDestination === destination.id ? "page" : undefined
          }
        >
          <span className={styles.navMarker} aria-hidden="true" />
          {destination.label}
        </Link>
      ))}
    </nav>
  );
}

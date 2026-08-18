import { redirect } from "next/navigation";
import Link from "next/link";
import { AccentColorForm } from "@/components/app-shell/accent-color-form";
import { AppNavigation } from "@/components/app-shell/app-navigation";
import styles from "@/components/app-shell/app-shell.module.css";
import { signOutAction } from "@/lib/actions/auth";
import { loadAuthenticatedProfile } from "@/lib/profiles/load-authenticated-profile";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await loadAuthenticatedProfile();
  if (profile.status === "unauthenticated") redirect("/login");

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.brand}>Cadence</p>
        <AppNavigation className={styles.desktopNavigation} />
        <div className={styles.utilities}>
          <AccentColorForm initialAccent={profile.accentColor} />
          <Link className={styles.accountLink} href="/account">
            Conta
          </Link>
          <form className={styles.logoutForm} action={signOutAction}>
            <button className={styles.logout} type="submit">
              Sair
            </button>
          </form>
        </div>
      </aside>
      <div className={styles.content}>{children}</div>
      <AppNavigation className={styles.mobileNavigation} />
    </div>
  );
}

"use client";

import { useActionState } from "react";
import {
  signInWithGoogleAction,
  type SignInWithGoogleState,
} from "@/lib/actions/auth";
import styles from "./login.module.css";

const initialState: SignInWithGoogleState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    signInWithGoogleAction,
    initialState,
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.brandPanel} aria-label="Sobre o Cadence">
          <p className={styles.brandLockup}>
            <span className={styles.brandMark} aria-hidden="true">
              <span />
              <span />
            </span>
            Cadence
          </p>

          <div className={styles.brandCopy}>
            <p className={styles.promise}>Seu dinheiro, no seu ritmo.</p>
            <p className={styles.brandDescription}>
              Uma visão clara do mês, das metas e das contas que se repetem.
            </p>
            <ul className={styles.productAreas} aria-label="Áreas do Cadence">
              <li>Dashboard</li>
              <li>Metas</li>
              <li>Contas fixas</li>
            </ul>
          </div>

          <p className={styles.privacy}>
            Privacidade por padrão · sem rastreamento comportamental.
          </p>
        </aside>

        <section className={styles.accessPanel} aria-labelledby="login-title">
          <div className={styles.accessContent}>
            <p className={styles.eyebrow}>Acesso</p>
            <h1 id="login-title">Que bom ter você de volta.</h1>
            <p className={styles.introduction}>
              Entre com sua conta Google para continuar acompanhando seu
              espaço.
            </p>

            <form
              action={formAction}
              className={styles.form}
              aria-busy={pending}
            >
              {state.error && (
                <p className={styles.error} id="login-error" role="alert">
                  {state.error}
                </p>
              )}

              <button
                className={styles.submit}
                type="submit"
                disabled={pending}
              >
                {pending ? "Redirecionando…" : "Continuar com Google"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import {
  signInWithGoogleAction,
  type SignInWithGoogleState,
} from "@/lib/actions/auth";
import styles from "./login.module.css";

const initialState: SignInWithGoogleState = { error: null };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

// Separado do resto da página porque useSearchParams() precisa de um
// Suspense boundary — sem isso, Next.js tira a rota inteira de renderização
// estática. `next` chega de /join/[token], para a esposa continuar o resgate
// do convite depois de logar pela primeira vez.
function AccessPanel() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [state, formAction, pending] = useActionState(
    signInWithGoogleAction,
    initialState,
  );

  return (
    <section className={styles.accessPanel} aria-labelledby="login-title">
      <div className={styles.accessContent}>
        <p className={styles.eyebrow}>Acesso</p>
        <h1 id="login-title">Que bom ter você de volta.</h1>
        <p className={styles.introduction}>
          Entre com sua conta Google para continuar acompanhando seu espaço.
        </p>

        <form action={formAction} className={styles.form} aria-busy={pending}>
          {next && <input type="hidden" name="next" value={next} />}

          {state.error && (
            <p className={styles.error} id="login-error" role="alert">
              {state.error}
            </p>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={pending}
            aria-label={
              pending ? "Redirecionando para o Google…" : "Continuar com Google"
            }
          >
            <GoogleIcon />
          </button>
        </form>
      </div>
    </section>
  );
}

export default function LoginPage() {
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

        <Suspense fallback={null}>
          <AccessPanel />
        </Suspense>
      </div>
    </main>
  );
}

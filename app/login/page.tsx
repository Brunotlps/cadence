"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, type SignInState } from "@/lib/actions/auth";
import styles from "./login.module.css";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const errorId = state.error ? "login-error" : undefined;

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
              Entre para continuar acompanhando seu espaço.
            </p>

            <form
              action={formAction}
              className={styles.form}
              aria-busy={pending}
            >
              <div className={styles.field}>
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-invalid={Boolean(state.error)}
                  aria-describedby={errorId}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Senha</label>
                <div className={styles.passwordControl}>
                  <input
                    id="password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    aria-invalid={Boolean(state.error)}
                    aria-describedby={errorId}
                  />
                  <button
                    className={styles.passwordToggle}
                    type="button"
                    aria-controls="password"
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  </button>
                </div>
              </div>

              <Link className={styles.forgotLink} href="/forgot-password">
                Esqueci minha senha
              </Link>

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
                {pending ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <p className={styles.signupPrompt}>
              Não tem conta? <Link href="/signup">Criar conta</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

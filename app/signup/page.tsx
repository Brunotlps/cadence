"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { signUpAction, type SignUpState } from "@/lib/actions/auth";
import styles from "@/components/auth/auth-shell.module.css";

const initialState: SignUpState = { error: null };

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const errorId = state.error ? "signup-error" : undefined;

  return (
    <AuthShell
      eyebrow="Comece por aqui"
      title="Criar conta"
      description="Organize o mês, acompanhe metas e mantenha as contas recorrentes em um só lugar."
      footer={
        <p>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      }
    >
      <form className={styles.form} action={formAction} aria-busy={pending}>
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
        <PasswordField
          id="password"
          label="Senha"
          autoComplete="new-password"
          invalid={Boolean(state.error)}
          describedBy={errorId}
        />
        {state.error && (
          <p className={styles.error} id={errorId} role="alert">
            {state.error}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Criando conta…" : "Criar conta"}
        </button>
      </form>
    </AuthShell>
  );
}

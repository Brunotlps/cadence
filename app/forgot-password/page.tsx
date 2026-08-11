"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  requestPasswordResetAction,
  type RequestPasswordResetState,
} from "@/lib/actions/auth";
import styles from "@/components/auth/auth-shell.module.css";

const initialState: RequestPasswordResetState = { message: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  return (
    <AuthShell
      eyebrow="Acesso"
      title="Recuperar senha"
      description="Informe seu e-mail. Se houver uma conta, enviaremos as instruções de recuperação."
      footer={<Link href="/login">Voltar para entrar</Link>}
    >
      <form className={styles.form} action={formAction} aria-busy={pending}>
        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar"}
        </button>
        {state.message && (
          <p className={styles.message} role="status">
            {state.message}
          </p>
        )}
      </form>
    </AuthShell>
  );
}

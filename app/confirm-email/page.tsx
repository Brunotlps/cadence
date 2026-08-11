"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  resendConfirmationAction,
  type ResendConfirmationState,
} from "@/lib/actions/auth";
import styles from "@/components/auth/auth-shell.module.css";

const initialState: ResendConfirmationState = { message: null };

export default function ConfirmEmailPage() {
  const [state, formAction, pending] = useActionState(
    resendConfirmationAction,
    initialState,
  );

  return (
    <AuthShell
      eyebrow="Quase lá"
      title="Confirme seu e-mail"
      description="Enviamos um link de confirmação para o e-mail informado no cadastro. Clique nele para ativar sua conta."
      footer={<Link href="/login">Voltar para entrar</Link>}
    >
      <form className={styles.form} action={formAction} aria-busy={pending}>
        <div className={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Reenviando…" : "Reenviar e-mail"}
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

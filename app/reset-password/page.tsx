"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import {
  updatePasswordAction,
  type UpdatePasswordState,
} from "@/lib/actions/auth";
import styles from "@/components/auth/auth-shell.module.css";

const initialState: UpdatePasswordState = { error: null };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialState,
  );
  const errorId = state.error ? "reset-password-error" : undefined;

  return (
    <AuthShell
      eyebrow="Segurança"
      title="Redefinir senha"
      description="Escolha uma nova senha para voltar ao seu espaço com segurança."
      footer={<Link href="/login">Voltar para entrar</Link>}
    >
      <form className={styles.form} action={formAction} aria-busy={pending}>
        <PasswordField
          id="password"
          label="Nova senha"
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
          {pending ? "Redefinindo…" : "Redefinir senha"}
        </button>
      </form>
    </AuthShell>
  );
}

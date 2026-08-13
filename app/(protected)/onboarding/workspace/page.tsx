"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  createWorkspaceAction,
  type CreateWorkspaceState,
} from "@/lib/actions/workspace";
import styles from "@/components/auth/auth-shell.module.css";

const initialState: CreateWorkspaceState = { error: null };

export default function CreateWorkspacePage() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    initialState,
  );
  const errorId = state.error ? "create-workspace-error" : undefined;

  return (
    <AuthShell
      eyebrow="Primeiros passos"
      title="Crie seu espaço"
      description="Lançamentos, metas e contas fixas ficam organizados dentro do mesmo espaço."
    >
      <form className={styles.form} action={formAction} aria-busy={pending}>
        <div className={styles.field}>
          <label htmlFor="name">Nome do espaço</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            aria-invalid={Boolean(state.error)}
            aria-describedby={errorId}
          />
        </div>
        {state.error && (
          <p className={styles.error} id={errorId} role="alert">
            {state.error}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Criando espaço…" : "Criar espaço"}
        </button>
      </form>
    </AuthShell>
  );
}

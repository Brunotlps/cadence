"use client";

import { useActionState, useState } from "react";
import {
  createWorkspaceInviteAction,
  type CreateWorkspaceInviteState,
} from "@/lib/actions/workspace";
import styles from "./invite-generator.module.css";

const initialState: CreateWorkspaceInviteState = {
  error: null,
  token: null,
  expiresAt: null,
};

function formatExpiresAt(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function InviteGenerator() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceInviteAction,
    initialState,
  );
  const [copied, setCopied] = useState(false);
  // window só é lido depois de uma interação (state.token começa null no
  // primeiro render, igual no servidor e no cliente) — sem risco de
  // mismatch de hidratação.
  const link =
    state.token && typeof window !== "undefined"
      ? `${window.location.origin}/join/${state.token}`
      : null;

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.card}>
      <form action={formAction} className={styles.form}>
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <button className={styles.generate} type="submit" disabled={pending}>
          {pending ? "Gerando…" : link ? "Gerar novo link" : "Gerar link de convite"}
        </button>
      </form>

      {link && state.expiresAt && (
        <div className={styles.result}>
          <label className={styles.linkLabel} htmlFor="invite-link">
            Link do convite
          </label>
          <div className={styles.linkRow}>
            <input
              id="invite-link"
              className={styles.linkInput}
              type="text"
              readOnly
              value={link}
              onFocus={(event) => event.target.select()}
            />
            <button className={styles.copy} type="button" onClick={handleCopy}>
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className={styles.expiry}>
            Válido até {formatExpiresAt(state.expiresAt)}, uso único.
          </p>
        </div>
      )}
    </div>
  );
}

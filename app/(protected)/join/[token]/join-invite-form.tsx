"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  redeemWorkspaceInviteAction,
  type RedeemWorkspaceInviteActionResult,
} from "@/lib/actions/workspace";
import styles from "@/components/auth/auth-shell.module.css";

const initialState: RedeemWorkspaceInviteActionResult = { status: "idle" };

const MESSAGES = {
  already_has_workspace:
    "Você já participa de um espaço no Cadence. Este convite não foi resgatado.",
  invalid_or_expired:
    "Convite inválido ou expirado. Peça para quem te convidou gerar um novo link.",
  error: "Não foi possível confirmar o convite. Tente novamente em alguns instantes.",
} as const;

type JoinInviteFormProps = {
  token: string;
};

export function JoinInviteForm({ token }: JoinInviteFormProps) {
  const [state, formAction, pending] = useActionState(
    redeemWorkspaceInviteAction,
    initialState,
  );
  const message = state.status === "idle" ? null : MESSAGES[state.status];

  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      {message && (
        <p className={styles.error} id="redeem-invite-result" role="alert">
          {message}
        </p>
      )}
      <button
        className={styles.submit}
        type="submit"
        disabled={pending}
        aria-describedby={message ? "redeem-invite-result" : undefined}
      >
        {pending ? "Confirmando convite..." : "Confirmar convite"}
      </button>
      {message && (
        <Link className={styles.submit} href="/dashboard">
          Ir para o Dashboard
        </Link>
      )}
    </form>
  );
}

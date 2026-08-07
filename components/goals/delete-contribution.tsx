"use client";

import { useActionState, useRef } from "react";
import { deleteContributionAction, type GoalActionState } from "@/lib/actions/goals";
import styles from "../transactions/delete-transaction.module.css";

const initialState: GoalActionState = { error: null, fieldErrors: {}, success: false };

export function DeleteContribution({ transactionId, dashboardLabel = false }: { transactionId: string; dashboardLabel?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteContributionAction.bind(null, transactionId), initialState);
  return <>
    <button className={styles.trigger} type="button" onClick={() => dialogRef.current?.showModal()}>{dashboardLabel ? "Excluir" : "Excluir aporte"}</button>
    <dialog className={styles.dialog} ref={dialogRef} aria-labelledby={`delete-contribution-${transactionId}`}>
      <h2 id={`delete-contribution-${transactionId}`}>Excluir aporte?</h2>
      <p>Esta ação não pode ser desfeita.</p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <button className={styles.cancel} type="button" disabled={pending} onClick={() => dialogRef.current?.close()}>Cancelar</button>
        <form action={formAction}><button className={styles.confirm} type="submit" disabled={pending}>{pending ? "Excluindo…" : "Excluir definitivamente"}</button></form>
      </div>
    </dialog>
  </>;
}

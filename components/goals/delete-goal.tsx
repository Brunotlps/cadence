"use client";

import { useActionState, useRef } from "react";
import { deleteGoalAction, type GoalActionState } from "@/lib/actions/goals";
import styles from "../transactions/delete-transaction.module.css";

const initialState: GoalActionState = { error: null, fieldErrors: {}, success: false };

export function DeleteGoal({ goalId, contributionCount }: { goalId: string; contributionCount: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteGoalAction.bind(null, goalId), initialState);
  return <>
    <button className={styles.trigger} type="button" onClick={() => dialogRef.current?.showModal()}>Excluir meta</button>
    <dialog className={styles.dialog} ref={dialogRef} aria-labelledby={`delete-goal-${goalId}`}>
      <h2 id={`delete-goal-${goalId}`}>Excluir meta?</h2>
      <p>{contributionCount === 1 ? "1 aporte ficará desvinculado." : `${contributionCount} aportes ficarão desvinculados.`} Os valores continuarão no histórico.</p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <button className={styles.cancel} type="button" disabled={pending} onClick={() => dialogRef.current?.close()}>Cancelar</button>
        <form action={formAction}><button className={styles.confirm} type="submit" disabled={pending}>{pending ? "Excluindo…" : "Excluir definitivamente"}</button></form>
      </div>
    </dialog>
  </>;
}

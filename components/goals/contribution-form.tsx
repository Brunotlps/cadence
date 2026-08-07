"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GoalActionState } from "@/lib/actions/goals";
import styles from "./goal-form.module.css";

const initialState: GoalActionState = { error: null, fieldErrors: {}, success: false };

type ContributionFormProps = {
  action: (state: GoalActionState, formData: FormData) => Promise<GoalActionState>;
  initialValues: { amount: string; occurredOn: string; goalId: string };
  goals?: Array<{ id: string; name: string }>;
  idPrefix: string;
  submitLabel: string;
  redirectOnSuccess?: string;
};

export function ContributionForm({ action, initialValues, goals, idPrefix, submitLabel, redirectOnSuccess }: ContributionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.success && redirectOnSuccess) router.replace(redirectOnSuccess);
  }, [redirectOnSuccess, router, state.success]);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-amount`}>Valor do aporte</label>
        <input id={`${idPrefix}-amount`} name="amount" inputMode="decimal" required defaultValue={initialValues.amount} aria-invalid={Boolean(state.fieldErrors.amount)} />
        {state.fieldErrors.amount && <p className={styles.fieldError}>{state.fieldErrors.amount}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-date`}>Data do aporte</label>
        <input id={`${idPrefix}-date`} name="occurredOn" type="date" required defaultValue={initialValues.occurredOn} aria-invalid={Boolean(state.fieldErrors.occurredOn)} />
        {state.fieldErrors.occurredOn && <p className={styles.fieldError}>{state.fieldErrors.occurredOn}</p>}
      </div>
      {goals && <div className={styles.field}>
        <label htmlFor={`${idPrefix}-goal`}>Meta</label>
        <select id={`${idPrefix}-goal`} name="goalId" required defaultValue={initialValues.goalId} aria-invalid={Boolean(state.fieldErrors.goalId)}>
          <option value="">Selecione uma meta</option>
          {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
        </select>
        {state.fieldErrors.goalId && <p className={styles.fieldError}>{state.fieldErrors.goalId}</p>}
      </div>}
      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      {state.success && !redirectOnSuccess && <p className={styles.success} role="status">Aporte salvo.</p>}
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Salvando…" : submitLabel}</button>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GoalActionState } from "@/lib/actions/goals";
import styles from "./goal-form.module.css";

const initialState: GoalActionState = { error: null, fieldErrors: {}, success: false };

type GoalFormProps = {
  action: (state: GoalActionState, formData: FormData) => Promise<GoalActionState>;
  initialValues: { name: string; targetAmount: string; suggestedMonthly: string };
  submitLabel: string;
  redirectOnSuccess?: string;
};

export function GoalForm({ action, initialValues, submitLabel, redirectOnSuccess }: GoalFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success && redirectOnSuccess) router.replace(redirectOnSuccess);
  }, [redirectOnSuccess, router, state.success]);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="goal-name">Nome da meta</label>
        <input id="goal-name" name="name" maxLength={100} required defaultValue={initialValues.name} aria-invalid={Boolean(state.fieldErrors.name)} />
        {state.fieldErrors.name && <p className={styles.fieldError}>{state.fieldErrors.name}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="goal-target">Valor-alvo</label>
        <input id="goal-target" name="targetAmount" inputMode="decimal" required defaultValue={initialValues.targetAmount} aria-invalid={Boolean(state.fieldErrors.targetAmount)} />
        {state.fieldErrors.targetAmount && <p className={styles.fieldError}>{state.fieldErrors.targetAmount}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="goal-pace">Ritmo mensal sugerido</label>
        <input id="goal-pace" name="suggestedMonthly" inputMode="decimal" defaultValue={initialValues.suggestedMonthly} aria-invalid={Boolean(state.fieldErrors.suggestedMonthly)} />
        {state.fieldErrors.suggestedMonthly && <p className={styles.fieldError}>{state.fieldErrors.suggestedMonthly}</p>}
      </div>
      {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
      {state.success && !redirectOnSuccess && <p className={styles.success} role="status">Meta salva.</p>}
      <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Salvando…" : submitLabel}</button>
    </form>
  );
}

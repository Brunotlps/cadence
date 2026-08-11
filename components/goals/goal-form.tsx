"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import formStyles from "@/components/ui/form-controls.module.css";
import type { GoalActionState } from "@/lib/actions/goals";

const initialState: GoalActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

type GoalFormProps = {
  action: (
    state: GoalActionState,
    formData: FormData,
  ) => Promise<GoalActionState>;
  initialValues: {
    name: string;
    targetAmount: string;
    suggestedMonthly: string;
  };
  submitLabel: string;
  redirectOnSuccess?: string;
};

export function GoalForm({
  action,
  initialValues,
  submitLabel,
  redirectOnSuccess,
}: GoalFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success && redirectOnSuccess) router.replace(redirectOnSuccess);
  }, [redirectOnSuccess, router, state.success]);

  return (
    <form action={formAction} className={formStyles.form} aria-busy={pending}>
      <div className={formStyles.field}>
        <label htmlFor="goal-name">Nome da meta</label>
        <input
          id="goal-name"
          name="name"
          maxLength={100}
          required
          defaultValue={initialValues.name}
          aria-invalid={Boolean(state.fieldErrors.name)}
          aria-describedby={state.fieldErrors.name ? "goal-name-error" : undefined}
        />
        {state.fieldErrors.name && (
          <p className={formStyles.fieldError} id="goal-name-error">
            {state.fieldErrors.name}
          </p>
        )}
      </div>
      <div className={formStyles.field}>
        <label htmlFor="goal-target">Valor-alvo</label>
        <input
          id="goal-target"
          name="targetAmount"
          inputMode="decimal"
          required
          defaultValue={initialValues.targetAmount}
          aria-invalid={Boolean(state.fieldErrors.targetAmount)}
          aria-describedby={
            state.fieldErrors.targetAmount ? "goal-target-error" : undefined
          }
        />
        {state.fieldErrors.targetAmount && (
          <p className={formStyles.fieldError} id="goal-target-error">
            {state.fieldErrors.targetAmount}
          </p>
        )}
      </div>
      <div className={formStyles.field}>
        <label htmlFor="goal-pace">Ritmo mensal sugerido</label>
        <input
          id="goal-pace"
          name="suggestedMonthly"
          inputMode="decimal"
          defaultValue={initialValues.suggestedMonthly}
          aria-invalid={Boolean(state.fieldErrors.suggestedMonthly)}
          aria-describedby={
            state.fieldErrors.suggestedMonthly ? "goal-pace-error" : undefined
          }
        />
        {state.fieldErrors.suggestedMonthly && (
          <p className={formStyles.fieldError} id="goal-pace-error">
            {state.fieldErrors.suggestedMonthly}
          </p>
        )}
      </div>
      {state.error && (
        <p className={formStyles.formError} role="alert">
          {state.error}
        </p>
      )}
      {state.success && !redirectOnSuccess && (
        <p className={formStyles.success} role="status">
          Meta salva.
        </p>
      )}
      <button className={formStyles.submit} type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

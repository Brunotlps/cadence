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

type ContributionFormProps = {
  action: (
    state: GoalActionState,
    formData: FormData,
  ) => Promise<GoalActionState>;
  initialValues: { amount: string; occurredOn: string; goalId: string };
  goals?: Array<{ id: string; name: string }>;
  idPrefix: string;
  submitLabel: string;
  redirectOnSuccess?: string;
};

export function ContributionForm({
  action,
  initialValues,
  goals,
  idPrefix,
  submitLabel,
  redirectOnSuccess,
}: ContributionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const amountErrorId = `${idPrefix}-amount-error`;
  const dateErrorId = `${idPrefix}-date-error`;
  const goalErrorId = `${idPrefix}-goal-error`;

  useEffect(() => {
    if (state.success && redirectOnSuccess) router.replace(redirectOnSuccess);
  }, [redirectOnSuccess, router, state.success]);

  return (
    <form action={formAction} className={formStyles.form} aria-busy={pending}>
      <div className={formStyles.field}>
        <label htmlFor={`${idPrefix}-amount`}>Valor do aporte</label>
        <input
          id={`${idPrefix}-amount`}
          name="amount"
          inputMode="decimal"
          required
          defaultValue={initialValues.amount}
          aria-invalid={Boolean(state.fieldErrors.amount)}
          aria-describedby={state.fieldErrors.amount ? amountErrorId : undefined}
        />
        {state.fieldErrors.amount && (
          <p className={formStyles.fieldError} id={amountErrorId}>
            {state.fieldErrors.amount}
          </p>
        )}
      </div>
      <div className={formStyles.field}>
        <label htmlFor={`${idPrefix}-date`}>Data do aporte</label>
        <input
          id={`${idPrefix}-date`}
          name="occurredOn"
          type="date"
          required
          defaultValue={initialValues.occurredOn}
          aria-invalid={Boolean(state.fieldErrors.occurredOn)}
          aria-describedby={
            state.fieldErrors.occurredOn ? dateErrorId : undefined
          }
        />
        {state.fieldErrors.occurredOn && (
          <p className={formStyles.fieldError} id={dateErrorId}>
            {state.fieldErrors.occurredOn}
          </p>
        )}
      </div>
      {goals && (
        <div className={formStyles.field}>
          <label htmlFor={`${idPrefix}-goal`}>Meta</label>
          <select
            id={`${idPrefix}-goal`}
            name="goalId"
            required
            defaultValue={initialValues.goalId}
            aria-invalid={Boolean(state.fieldErrors.goalId)}
            aria-describedby={state.fieldErrors.goalId ? goalErrorId : undefined}
          >
            <option value="">Selecione uma meta</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
          {state.fieldErrors.goalId && (
            <p className={formStyles.fieldError} id={goalErrorId}>
              {state.fieldErrors.goalId}
            </p>
          )}
        </div>
      )}
      {state.error && (
        <p className={formStyles.formError} role="alert">
          {state.error}
        </p>
      )}
      {state.success && !redirectOnSuccess && (
        <p className={formStyles.success} role="status">
          Aporte salvo.
        </p>
      )}
      <button className={formStyles.submit} type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

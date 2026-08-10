"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FixedBillActionState } from "@/lib/actions/fixed-bills";
import { TRANSACTION_CATEGORIES } from "@/lib/transactions/categories";
import styles from "./form.module.css";

const initialState: FixedBillActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

type FixedBillFormProps = {
  action: (
    state: FixedBillActionState,
    formData: FormData,
  ) => Promise<FixedBillActionState>;
  initialValues: {
    name: string;
    dueDay: string;
    category: string;
    estimatedAmount: string;
    autopay: boolean;
    variableAmount: boolean;
  };
  submitLabel: string;
  redirectOnSuccess?: string;
};

const expenseCategories = TRANSACTION_CATEGORIES.filter(
  (category) => category.code !== "renda",
);

export function FixedBillForm({
  action,
  initialValues,
  submitLabel,
  redirectOnSuccess,
}: FixedBillFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (!state.success) return;
    if (redirectOnSuccess) router.replace(redirectOnSuccess);
    else router.refresh();
  }, [redirectOnSuccess, router, state.success]);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="fixed-bill-name">Nome da conta</label>
        <input
          id="fixed-bill-name"
          name="name"
          maxLength={100}
          required
          defaultValue={initialValues.name}
          aria-invalid={Boolean(state.fieldErrors.name)}
        />
        {state.fieldErrors.name && (
          <p className={styles.fieldError}>{state.fieldErrors.name}</p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor="fixed-bill-due-day">Dia do vencimento</label>
        <input
          id="fixed-bill-due-day"
          name="dueDay"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={initialValues.dueDay}
          aria-invalid={Boolean(state.fieldErrors.dueDay)}
        />
        {state.fieldErrors.dueDay && (
          <p className={styles.fieldError}>{state.fieldErrors.dueDay}</p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor="fixed-bill-category">Categoria</label>
        <select
          id="fixed-bill-category"
          name="category"
          required
          defaultValue={initialValues.category}
          aria-invalid={Boolean(state.fieldErrors.category)}
        >
          <option value="">Selecione uma categoria</option>
          {expenseCategories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.label}
            </option>
          ))}
        </select>
        {state.fieldErrors.category && (
          <p className={styles.fieldError}>{state.fieldErrors.category}</p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor="fixed-bill-estimate">Valor previsto</label>
        <input
          id="fixed-bill-estimate"
          name="estimatedAmount"
          inputMode="decimal"
          required
          defaultValue={initialValues.estimatedAmount}
          aria-invalid={Boolean(state.fieldErrors.estimatedAmount)}
        />
        {state.fieldErrors.estimatedAmount && (
          <p className={styles.fieldError}>
            {state.fieldErrors.estimatedAmount}
          </p>
        )}
      </div>
      <label className={styles.checkField}>
        <input
          name="variableAmount"
          type="checkbox"
          defaultChecked={initialValues.variableAmount}
        />
        <span>Valor variável</span>
      </label>
      <label className={styles.checkField}>
        <input
          name="autopay"
          type="checkbox"
          defaultChecked={initialValues.autopay}
        />
        <span>Débito automático</span>
      </label>
      {state.error && (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      )}
      {state.success && !redirectOnSuccess && (
        <p className={styles.success} role="status">
          Conta fixa salva.
        </p>
      )}
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

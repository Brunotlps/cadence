"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import formStyles from "@/components/ui/form-controls.module.css";
import type { FixedBillActionState } from "@/lib/actions/fixed-bills";
import { PAYMENT_METHODS } from "@/lib/transactions/payment-methods";

const initialState: FixedBillActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

type BillPaymentFormProps = {
  action: (
    state: FixedBillActionState,
    formData: FormData,
  ) => Promise<FixedBillActionState>;
  initialValues: {
    amount: string;
    occurredOn: string;
    paymentMethod: string;
    fixedBillId: string;
  };
  fixedBills?: Array<{ id: string; name: string }>;
  idPrefix: string;
  submitLabel: string;
  redirectOnSuccess?: string;
};

export function BillPaymentForm({
  action,
  initialValues,
  fixedBills,
  idPrefix,
  submitLabel,
  redirectOnSuccess,
}: BillPaymentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const amountErrorId = `${idPrefix}-amount-error`;
  const dateErrorId = `${idPrefix}-date-error`;
  const methodErrorId = `${idPrefix}-method-error`;
  const billErrorId = `${idPrefix}-bill-error`;

  useEffect(() => {
    if (!state.success) return;
    if (redirectOnSuccess) router.replace(redirectOnSuccess);
    else router.refresh();
  }, [redirectOnSuccess, router, state.success]);

  return (
    <form action={formAction} className={formStyles.form} aria-busy={pending}>
      <div className={formStyles.field}>
        <label htmlFor={`${idPrefix}-amount`}>Valor do pagamento</label>
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
        <label htmlFor={`${idPrefix}-date`}>Data do pagamento</label>
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
      <div className={formStyles.field}>
        <label htmlFor={`${idPrefix}-method`}>Forma de pagamento</label>
        <select
          id={`${idPrefix}-method`}
          name="paymentMethod"
          defaultValue={initialValues.paymentMethod}
          aria-invalid={Boolean(state.fieldErrors.paymentMethod)}
          aria-describedby={
            state.fieldErrors.paymentMethod ? methodErrorId : undefined
          }
        >
          <option value="">Não informada</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.code} value={method.code}>
              {method.label}
            </option>
          ))}
        </select>
        {state.fieldErrors.paymentMethod && (
          <p className={formStyles.fieldError} id={methodErrorId}>
            {state.fieldErrors.paymentMethod}
          </p>
        )}
      </div>
      {fixedBills && (
        <div className={formStyles.field}>
          <label htmlFor={`${idPrefix}-bill`}>Conta fixa</label>
          <select
            id={`${idPrefix}-bill`}
            name="fixedBillId"
            required
            defaultValue={initialValues.fixedBillId}
            aria-invalid={Boolean(state.fieldErrors.fixedBillId)}
            aria-describedby={
              state.fieldErrors.fixedBillId ? billErrorId : undefined
            }
          >
            <option value="">Selecione uma conta fixa</option>
            {fixedBills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.name}
              </option>
            ))}
          </select>
          {state.fieldErrors.fixedBillId && (
            <p className={formStyles.fieldError} id={billErrorId}>
              {state.fieldErrors.fixedBillId}
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
          Pagamento salvo.
        </p>
      )}
      <button className={formStyles.submit} type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

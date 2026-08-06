"use client";

import { useActionState, useState } from "react";
import type { TransactionActionState } from "@/lib/actions/transactions";
import {
  TRANSACTION_CATEGORIES,
  type TransactionCategoryCode,
} from "@/lib/transactions/categories";
import {
  PAYMENT_METHODS,
  type PaymentMethodCode,
} from "@/lib/transactions/payment-methods";

const initialState: TransactionActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

type TransactionFormValues = {
  amount: string;
  category: TransactionCategoryCode | "";
  occurredOn: string;
  description: string;
  paymentMethod: PaymentMethodCode | "";
};

type TransactionFormProps = {
  action: (
    state: TransactionActionState,
    formData: FormData,
  ) => Promise<TransactionActionState>;
  initialValues: TransactionFormValues;
  month: string;
  submitLabel: string;
};

export function TransactionForm({
  action,
  initialValues,
  month,
  submitLabel,
}: TransactionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(initialValues.description || initialValues.paymentMethod),
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="month" value={month} />

      <div>
        <label htmlFor="transaction-amount">Valor</label>
        <input
          id="transaction-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={initialValues.amount}
          aria-invalid={Boolean(state.fieldErrors.amount)}
          aria-describedby={
            state.fieldErrors.amount ? "transaction-amount-error" : undefined
          }
        />
        {state.fieldErrors.amount && (
          <p id="transaction-amount-error">{state.fieldErrors.amount}</p>
        )}
      </div>

      <div>
        <label htmlFor="transaction-category">Categoria</label>
        <select
          id="transaction-category"
          name="category"
          required
          defaultValue={initialValues.category}
          aria-invalid={Boolean(state.fieldErrors.category)}
          aria-describedby={
            state.fieldErrors.category
              ? "transaction-category-error"
              : undefined
          }
        >
          <option value="">Selecione uma categoria</option>
          {TRANSACTION_CATEGORIES.map((category) => (
            <option key={category.code} value={category.code}>
              {category.label}
            </option>
          ))}
        </select>
        {state.fieldErrors.category && (
          <p id="transaction-category-error">{state.fieldErrors.category}</p>
        )}
      </div>

      <div>
        <label htmlFor="transaction-date">Data</label>
        <input
          id="transaction-date"
          name="occurredOn"
          type="date"
          required
          defaultValue={initialValues.occurredOn}
          aria-invalid={Boolean(state.fieldErrors.occurredOn)}
          aria-describedby={
            state.fieldErrors.occurredOn ? "transaction-date-error" : undefined
          }
        />
        {state.fieldErrors.occurredOn && (
          <p id="transaction-date-error">{state.fieldErrors.occurredOn}</p>
        )}
      </div>

      <button
        type="button"
        aria-expanded={detailsOpen}
        aria-controls="transaction-details"
        onClick={() => setDetailsOpen((current) => !current)}
      >
        {detailsOpen ? "− menos detalhes" : "+ mais detalhes"}
      </button>
      <div id="transaction-details" hidden={!detailsOpen}>
        <div>
          <label htmlFor="transaction-description">Descrição</label>
          <input
            id="transaction-description"
            name="description"
            type="text"
            maxLength={200}
            defaultValue={initialValues.description}
            aria-invalid={Boolean(state.fieldErrors.description)}
            aria-describedby={
              state.fieldErrors.description
                ? "transaction-description-error"
                : undefined
            }
          />
          {state.fieldErrors.description && (
            <p id="transaction-description-error">
              {state.fieldErrors.description}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="transaction-payment-method">
            Forma de pagamento
          </label>
          <select
            id="transaction-payment-method"
            name="paymentMethod"
            defaultValue={initialValues.paymentMethod}
            aria-invalid={Boolean(state.fieldErrors.paymentMethod)}
            aria-describedby={
              state.fieldErrors.paymentMethod
                ? "transaction-payment-method-error"
                : undefined
            }
          >
            <option value="">Não informada</option>
            {PAYMENT_METHODS.map((paymentMethod) => (
              <option key={paymentMethod.code} value={paymentMethod.code}>
                {paymentMethod.label}
              </option>
            ))}
          </select>
          {state.fieldErrors.paymentMethod && (
            <p id="transaction-payment-method-error">
              {state.fieldErrors.paymentMethod}
            </p>
          )}
        </div>
      </div>

      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">Lançamento salvo.</p>}

      <button type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

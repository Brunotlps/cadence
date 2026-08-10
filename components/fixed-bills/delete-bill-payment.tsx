"use client";

import { useActionState, useRef } from "react";
import {
  deleteBillPaymentAction,
  type FixedBillActionState,
} from "@/lib/actions/fixed-bills";
import styles from "../transactions/delete-transaction.module.css";

const initialState: FixedBillActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

export function DeleteBillPayment({
  transactionId,
  dashboardLabel = false,
}: {
  transactionId: string;
  dashboardLabel?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(
    deleteBillPaymentAction.bind(null, transactionId),
    initialState,
  );

  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        {dashboardLabel ? "Excluir" : "Excluir pagamento"}
      </button>
      <dialog
        className={styles.dialog}
        ref={dialogRef}
        aria-labelledby={`delete-bill-payment-${transactionId}`}
      >
        <h2 id={`delete-bill-payment-${transactionId}`}>
          Excluir pagamento?
        </h2>
        <p>Esta ação não pode ser desfeita.</p>
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
        <div className={styles.actions}>
          <button
            className={styles.cancel}
            type="button"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            Cancelar
          </button>
          <form action={formAction}>
            <button
              className={styles.confirm}
              type="submit"
              disabled={pending}
            >
              {pending ? "Excluindo…" : "Excluir definitivamente"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

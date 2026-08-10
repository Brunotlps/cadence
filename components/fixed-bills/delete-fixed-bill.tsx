"use client";

import { useActionState, useRef } from "react";
import {
  deleteFixedBillAction,
  type FixedBillActionState,
} from "@/lib/actions/fixed-bills";
import styles from "../transactions/delete-transaction.module.css";

const initialState: FixedBillActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

export function DeleteFixedBill({
  fixedBillId,
  paymentCount,
}: {
  fixedBillId: string;
  paymentCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(
    deleteFixedBillAction.bind(null, fixedBillId),
    initialState,
  );
  const unlinkMessage =
    paymentCount === 1
      ? "1 pagamento ficará desvinculado."
      : `${paymentCount} pagamentos ficarão desvinculados.`;

  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Encerrar recorrência
      </button>
      <dialog
        className={styles.dialog}
        ref={dialogRef}
        aria-labelledby={`delete-fixed-bill-${fixedBillId}`}
      >
        <h2 id={`delete-fixed-bill-${fixedBillId}`}>
          Encerrar recorrência?
        </h2>
        <p>{unlinkMessage} Os lançamentos continuarão no histórico.</p>
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
              {pending ? "Encerrando…" : "Encerrar definitivamente"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

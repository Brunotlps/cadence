"use client";

import { useActionState, useRef } from "react";
import {
  deleteTransactionAction,
  type TransactionActionState,
} from "@/lib/actions/transactions";

const initialState: TransactionActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

type DeleteTransactionProps = {
  transactionId: string;
  returnMonth?: string | null;
};

export function DeleteTransaction({
  transactionId,
  returnMonth = null,
}: DeleteTransactionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = deleteTransactionAction.bind(
    null,
    transactionId,
    returnMonth,
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()}>
        Excluir
      </button>
      <dialog ref={dialogRef} aria-labelledby={`delete-title-${transactionId}`}>
        <h2 id={`delete-title-${transactionId}`}>Excluir lançamento?</h2>
        <p>Esta ação não pode ser desfeita.</p>
        {state.error && <p role="alert">{state.error}</p>}
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            Cancelar
          </button>
          <form action={formAction}>
            <button type="submit" disabled={pending}>
              {pending ? "Excluindo…" : "Excluir definitivamente"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const action = deleteTransactionAction.bind(
    null,
    transactionId,
    returnMonth,
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <ConfirmDialog
      triggerLabel="Excluir"
      title="Excluir lançamento?"
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir definitivamente"
      pendingLabel="Excluindo…"
      pending={pending}
      error={state.error}
      formAction={formAction}
    />
  );
}

"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteBillPaymentAction,
  type FixedBillActionState,
} from "@/lib/actions/fixed-bills";

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
  const [state, formAction, pending] = useActionState(
    deleteBillPaymentAction.bind(null, transactionId),
    initialState,
  );

  return (
    <ConfirmDialog
      triggerLabel={dashboardLabel ? "Excluir" : "Excluir pagamento"}
      title="Excluir pagamento?"
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir definitivamente"
      pendingLabel="Excluindo…"
      pending={pending}
      error={state.error}
      formAction={formAction}
    />
  );
}

"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteFixedBillAction,
  type FixedBillActionState,
} from "@/lib/actions/fixed-bills";

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
  const [state, formAction, pending] = useActionState(
    deleteFixedBillAction.bind(null, fixedBillId),
    initialState,
  );
  const unlinkMessage =
    paymentCount === 1
      ? "1 pagamento ficará desvinculado."
      : `${paymentCount} pagamentos ficarão desvinculados.`;

  return (
    <ConfirmDialog
      triggerLabel="Encerrar recorrência"
      title="Encerrar recorrência?"
      description={`${unlinkMessage} Os lançamentos continuarão no histórico.`}
      confirmLabel="Encerrar definitivamente"
      pendingLabel="Encerrando…"
      pending={pending}
      error={state.error}
      formAction={formAction}
    />
  );
}

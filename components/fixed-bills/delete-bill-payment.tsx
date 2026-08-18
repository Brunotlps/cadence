"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  redirectOnSuccess,
}: {
  transactionId: string;
  dashboardLabel?: boolean;
  redirectOnSuccess?: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteBillPaymentAction.bind(null, transactionId),
    initialState,
  );
  const router = useRouter();
  const redirecting = Boolean(state.success && redirectOnSuccess);

  useEffect(() => {
    if (state.success && redirectOnSuccess) router.replace(redirectOnSuccess);
  }, [redirectOnSuccess, router, state.success]);

  return (
    <ConfirmDialog
      triggerLabel={dashboardLabel ? "Excluir" : "Excluir pagamento"}
      title="Excluir pagamento?"
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir definitivamente"
      pendingLabel="Excluindo…"
      pending={pending || redirecting}
      error={state.error}
      formAction={formAction}
    />
  );
}

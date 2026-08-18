"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteContributionAction,
  type GoalActionState,
} from "@/lib/actions/goals";

const initialState: GoalActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

export function DeleteContribution({
  transactionId,
  dashboardLabel = false,
  redirectOnSuccess,
}: {
  transactionId: string;
  dashboardLabel?: boolean;
  redirectOnSuccess?: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteContributionAction.bind(null, transactionId),
    initialState,
  );
  const router = useRouter();
  const redirecting = Boolean(state.success && redirectOnSuccess);

  useEffect(() => {
    if (state.success && redirectOnSuccess) router.replace(redirectOnSuccess);
  }, [redirectOnSuccess, router, state.success]);

  return (
    <ConfirmDialog
      triggerLabel={dashboardLabel ? "Excluir" : "Excluir aporte"}
      title="Excluir aporte?"
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir definitivamente"
      pendingLabel="Excluindo…"
      pending={pending || redirecting}
      error={state.error}
      formAction={formAction}
    />
  );
}

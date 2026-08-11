"use client";

import { useActionState } from "react";
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
}: {
  transactionId: string;
  dashboardLabel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    deleteContributionAction.bind(null, transactionId),
    initialState,
  );

  return (
    <ConfirmDialog
      triggerLabel={dashboardLabel ? "Excluir" : "Excluir aporte"}
      title="Excluir aporte?"
      description="Esta ação não pode ser desfeita."
      confirmLabel="Excluir definitivamente"
      pendingLabel="Excluindo…"
      pending={pending}
      error={state.error}
      formAction={formAction}
    />
  );
}

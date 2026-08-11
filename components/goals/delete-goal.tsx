"use client";

import { useActionState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteGoalAction, type GoalActionState } from "@/lib/actions/goals";

const initialState: GoalActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

export function DeleteGoal({
  goalId,
  contributionCount,
}: {
  goalId: string;
  contributionCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    deleteGoalAction.bind(null, goalId),
    initialState,
  );
  const description = `${
    contributionCount === 1
      ? "1 aporte ficará desvinculado."
      : `${contributionCount} aportes ficarão desvinculados.`
  } Os valores continuarão no histórico.`;

  return (
    <ConfirmDialog
      triggerLabel="Excluir meta"
      title="Excluir meta?"
      description={description}
      confirmLabel="Excluir definitivamente"
      pendingLabel="Excluindo…"
      pending={pending}
      error={state.error}
      formAction={formAction}
    />
  );
}

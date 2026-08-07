"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTodayInSaoPaulo } from "@/lib/transactions/civil-date";
import {
  deleteContribution,
  deleteGoal,
  getGoalById,
  insertContribution,
  insertGoal,
  updateContribution,
  updateGoal,
} from "@/lib/goals/repository";
import { validateContributionInput } from "@/lib/goals/validate-contribution";
import { validateGoalInput } from "@/lib/goals/validate-goal";
import { getCurrentWorkspace } from "@/lib/workspace/repository";

const SAVE_GOAL_ERROR = "Não foi possível salvar a meta.";
const DELETE_GOAL_ERROR = "Não foi possível excluir a meta.";
const SAVE_CONTRIBUTION_ERROR = "Não foi possível salvar o aporte.";
const DELETE_CONTRIBUTION_ERROR = "Não foi possível excluir o aporte.";

export type GoalActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  success: boolean;
};

type ActionContext = {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
};

function failure(
  error: string,
  fieldErrors: Record<string, string> = {},
): GoalActionState {
  return { error, fieldErrors, success: false };
}

function success(): GoalActionState {
  return { error: null, fieldErrors: {}, success: true };
}

async function getActionContext(): Promise<ActionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const workspaceResult = await getCurrentWorkspace(supabase, user.id);
  if (workspaceResult.error || !workspaceResult.data) return null;

  return {
    supabase,
    userId: user.id,
    workspaceId: workspaceResult.data.id,
  };
}

function validateGoalForm(formData: FormData) {
  return validateGoalInput({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    suggestedMonthly: formData.get("suggestedMonthly"),
  });
}

function validateContributionForm(formData: FormData, goalId: unknown) {
  return validateContributionInput(
    {
      amount: formData.get("amount"),
      occurredOn: formData.get("occurredOn"),
      goalId,
    },
    getTodayInSaoPaulo(),
  );
}

function revalidateContributionPaths() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function createGoalAction(
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_GOAL_ERROR);

  const validation = validateGoalForm(formData);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const result = await insertGoal(context.supabase, {
    workspaceId: context.workspaceId,
    goal: validation.data,
  });
  if (result.error) return failure(SAVE_GOAL_ERROR);

  revalidatePath("/goals");
  return success();
}

export async function updateGoalAction(
  goalId: string,
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_GOAL_ERROR);

  const validation = validateGoalForm(formData);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const result = await updateGoal(context.supabase, {
    workspaceId: context.workspaceId,
    goalId,
    goal: validation.data,
  });
  if (result.error || !result.data) return failure(SAVE_GOAL_ERROR);

  revalidatePath("/goals");
  return success();
}

export async function deleteGoalAction(
  goalId: string,
  _prevState: GoalActionState,
  _formData: FormData,
): Promise<GoalActionState> {
  void _prevState;
  void _formData;

  const context = await getActionContext();
  if (!context) return failure(DELETE_GOAL_ERROR);

  const result = await deleteGoal(context.supabase, {
    workspaceId: context.workspaceId,
    goalId,
  });
  if (result.error || !result.data) return failure(DELETE_GOAL_ERROR);

  revalidatePath("/goals");
  return success();
}

export async function createContributionAction(
  goalId: string,
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_CONTRIBUTION_ERROR);

  const validation = validateContributionForm(formData, goalId);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const goalResult = await getGoalById(context.supabase, {
    workspaceId: context.workspaceId,
    goalId,
  });
  if (goalResult.error || !goalResult.data) {
    return failure(SAVE_CONTRIBUTION_ERROR);
  }

  const result = await insertContribution(context.supabase, {
    workspaceId: context.workspaceId,
    createdBy: context.userId,
    contribution: validation.data,
  });
  if (result.error) return failure(SAVE_CONTRIBUTION_ERROR);

  revalidateContributionPaths();
  return success();
}

export async function updateContributionAction(
  transactionId: string,
  _prevState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_CONTRIBUTION_ERROR);

  const validation = validateContributionForm(
    formData,
    formData.get("goalId"),
  );
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const goalResult = await getGoalById(context.supabase, {
    workspaceId: context.workspaceId,
    goalId: validation.data.goalId,
  });
  if (goalResult.error || !goalResult.data) {
    return failure(SAVE_CONTRIBUTION_ERROR);
  }

  const result = await updateContribution(context.supabase, {
    workspaceId: context.workspaceId,
    transactionId,
    contribution: validation.data,
  });
  if (result.error || !result.data) return failure(SAVE_CONTRIBUTION_ERROR);

  revalidateContributionPaths();
  return success();
}

export async function deleteContributionAction(
  transactionId: string,
  _prevState: GoalActionState,
  _formData: FormData,
): Promise<GoalActionState> {
  void _prevState;
  void _formData;

  const context = await getActionContext();
  if (!context) return failure(DELETE_CONTRIBUTION_ERROR);

  const result = await deleteContribution(context.supabase, {
    workspaceId: context.workspaceId,
    transactionId,
  });
  if (result.error || !result.data) {
    return failure(DELETE_CONTRIBUTION_ERROR);
  }

  revalidateContributionPaths();
  return success();
}

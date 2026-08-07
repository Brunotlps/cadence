import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentWorkspace,
  type CurrentWorkspace,
} from "@/lib/workspace/repository";
import {
  getContributionById,
  getGoalById,
  listGoals,
  type ContributionRecord,
  type GoalRecord,
} from "./repository";

export type GoalEditResult =
  | {
      status: "ready";
      data: { workspace: CurrentWorkspace; goal: GoalRecord };
    }
  | { status: "no_workspace" }
  | { status: "error" };

export type ContributionEditResult =
  | {
      status: "ready";
      data: {
        workspace: CurrentWorkspace;
        contribution: ContributionRecord;
        goals: GoalRecord[];
      };
    }
  | { status: "no_workspace" }
  | { status: "error" };

export async function loadGoalForEdit(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
): Promise<GoalEditResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const goalResult = await getGoalById(supabase, {
    workspaceId: workspaceResult.data.id,
    goalId,
  });
  if (goalResult.error || !goalResult.data) return { status: "error" };

  return {
    status: "ready",
    data: { workspace: workspaceResult.data, goal: goalResult.data },
  };
}

export async function loadContributionForEdit(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
): Promise<ContributionEditResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const contributionResult = await getContributionById(supabase, {
    workspaceId: workspaceResult.data.id,
    transactionId,
  });
  if (contributionResult.error || !contributionResult.data) {
    return { status: "error" };
  }

  const goalsResult = await listGoals(supabase, workspaceResult.data.id);
  if (goalsResult.error) return { status: "error" };

  return {
    status: "ready",
    data: {
      workspace: workspaceResult.data,
      contribution: contributionResult.data,
      goals: goalsResult.data,
    },
  };
}

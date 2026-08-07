import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodayInSaoPaulo } from "@/lib/transactions/civil-date";
import {
  getCurrentWorkspace,
  type CurrentWorkspace,
} from "@/lib/workspace/repository";
import {
  calculateGoalProgress,
  type GoalProgress,
} from "./calculate-goal-progress";
import {
  listGoalContributions,
  listGoals,
  type ContributionRecord,
  type GoalRecord,
} from "./repository";

export type GoalDashboardItem = GoalRecord & {
  contributions: ContributionRecord[];
  contributionCount: number;
  progress: GoalProgress;
};

export type GoalsDashboardData = {
  workspace: CurrentWorkspace;
  today: string;
  goals: GoalDashboardItem[];
};

export type GoalsDashboardResult =
  | { status: "ready"; data: GoalsDashboardData }
  | { status: "no_workspace" }
  | { status: "error" };

export async function loadGoalsDashboard(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<GoalsDashboardResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const today = getTodayInSaoPaulo(now);
  const [goalsResult, contributionsResult] = await Promise.all([
    listGoals(supabase, workspaceResult.data.id),
    listGoalContributions(supabase, {
      workspaceId: workspaceResult.data.id,
      throughDate: today,
    }),
  ]);
  if (goalsResult.error || contributionsResult.error) {
    return { status: "error" };
  }

  const contributionsByGoal = new Map<string, ContributionRecord[]>();
  for (const contribution of contributionsResult.data) {
    if (!contribution.goalId) continue;
    const current = contributionsByGoal.get(contribution.goalId) ?? [];
    current.push(contribution);
    contributionsByGoal.set(contribution.goalId, current);
  }

  try {
    return {
      status: "ready",
      data: {
        workspace: workspaceResult.data,
        today,
        goals: goalsResult.data.map((goal) => {
          const contributions = contributionsByGoal.get(goal.id) ?? [];
          return {
            ...goal,
            contributions,
            contributionCount: contributions.length,
            progress: calculateGoalProgress(
              {
                targetAmount: goal.targetAmount,
                suggestedMonthly: goal.suggestedMonthly,
                startedOn: goal.startedOn,
              },
              contributions,
              today,
            ),
          };
        }),
      },
    };
  } catch {
    return { status: "error" };
  }
}

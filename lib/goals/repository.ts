import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedContributionInput } from "./validate-contribution";
import type { NormalizedGoalInput } from "./validate-goal";

const GOAL_COLUMNS =
  "id, name, target_amount, suggested_monthly, started_on, created_at";
const CONTRIBUTION_COLUMNS =
  "id, goal_id, created_by, amount, occurred_on, created_at";

export type GoalRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: "query_failed" };

export type GoalRecord = {
  id: string;
  name: string;
  targetAmount: string;
  suggestedMonthly: string | null;
  startedOn: string;
  createdAt: string;
};

export type ContributionRecord = {
  id: string;
  goalId: string | null;
  createdBy: string;
  amount: string;
  occurredOn: string;
  createdAt: string;
};

type RawGoal = {
  id: string;
  name: string;
  target_amount: string | number;
  suggested_monthly: string | number | null;
  started_on: string;
  created_at: string;
};

type RawContribution = {
  id: string;
  goal_id: string | null;
  created_by: string;
  amount: string | number;
  occurred_on: string;
  created_at: string;
};

type GoalLocator = {
  workspaceId: string;
  goalId: string;
};

type ContributionLocator = {
  workspaceId: string;
  transactionId: string;
};

function queryFailed<T>(): GoalRepositoryResult<T> {
  return { data: null, error: "query_failed" };
}

function mapGoal(row: RawGoal): GoalRecord {
  return {
    id: row.id,
    name: row.name,
    targetAmount: String(row.target_amount),
    suggestedMonthly:
      row.suggested_monthly === null ? null : String(row.suggested_monthly),
    startedOn: row.started_on,
    createdAt: row.created_at,
  };
}

function mapContribution(row: RawContribution): ContributionRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    createdBy: row.created_by,
    amount: String(row.amount),
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
  };
}

function goalPayload(goal: NormalizedGoalInput) {
  return {
    name: goal.name,
    target_amount: goal.targetAmount,
    suggested_monthly: goal.suggestedMonthly,
  };
}

function contributionPayload(contribution: NormalizedContributionInput) {
  return {
    amount: contribution.amount,
    goal_id: contribution.goalId,
    occurred_on: contribution.occurredOn,
  };
}

export async function listGoals(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<GoalRepositoryResult<GoalRecord[]>> {
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return queryFailed();
  return {
    data: ((data ?? []) as RawGoal[]).map(mapGoal),
    error: null,
  };
}

export async function listGoalContributions(
  supabase: SupabaseClient,
  input: { workspaceId: string; throughDate: string },
): Promise<GoalRepositoryResult<ContributionRecord[]>> {
  const { data, error } = await supabase
    .from("transactions")
    .select(CONTRIBUTION_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "contribution")
    .not("goal_id", "is", null)
    .lte("occurred_on", input.throughDate)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return queryFailed();
  return {
    data: ((data ?? []) as RawContribution[]).map(mapContribution),
    error: null,
  };
}

export async function getGoalById(
  supabase: SupabaseClient,
  input: GoalLocator,
): Promise<GoalRepositoryResult<GoalRecord | null>> {
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("id", input.goalId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) return queryFailed();
  return { data: data ? mapGoal(data as RawGoal) : null, error: null };
}

export async function insertGoal(
  supabase: SupabaseClient,
  input: { workspaceId: string; goal: NormalizedGoalInput },
): Promise<GoalRepositoryResult<GoalRecord>> {
  const { data, error } = await supabase
    .from("goals")
    .insert({ workspace_id: input.workspaceId, ...goalPayload(input.goal) })
    .select(GOAL_COLUMNS)
    .single();

  if (error || !data) return queryFailed();
  return { data: mapGoal(data as RawGoal), error: null };
}

export async function updateGoal(
  supabase: SupabaseClient,
  input: GoalLocator & { goal: NormalizedGoalInput },
): Promise<GoalRepositoryResult<GoalRecord | null>> {
  const { data, error } = await supabase
    .from("goals")
    .update(goalPayload(input.goal))
    .eq("id", input.goalId)
    .eq("workspace_id", input.workspaceId)
    .select(GOAL_COLUMNS)
    .maybeSingle();

  if (error) return queryFailed();
  return { data: data ? mapGoal(data as RawGoal) : null, error: null };
}

export async function deleteGoal(
  supabase: SupabaseClient,
  input: GoalLocator,
): Promise<GoalRepositoryResult<boolean>> {
  const { data, error } = await supabase
    .from("goals")
    .delete()
    .eq("id", input.goalId)
    .eq("workspace_id", input.workspaceId)
    .select("id")
    .maybeSingle();

  if (error) return queryFailed();
  return { data: data !== null, error: null };
}

export async function getContributionById(
  supabase: SupabaseClient,
  input: ContributionLocator,
): Promise<GoalRepositoryResult<ContributionRecord | null>> {
  const { data, error } = await supabase
    .from("transactions")
    .select(CONTRIBUTION_COLUMNS)
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "contribution")
    .maybeSingle();

  if (error) return queryFailed();
  return {
    data: data ? mapContribution(data as RawContribution) : null,
    error: null,
  };
}

export async function insertContribution(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    createdBy: string;
    contribution: NormalizedContributionInput;
  },
): Promise<GoalRepositoryResult<ContributionRecord>> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      kind: "contribution",
      amount: input.contribution.amount,
      category: null,
      description: null,
      payment_method: null,
      goal_id: input.contribution.goalId,
      occurred_on: input.contribution.occurredOn,
    })
    .select(CONTRIBUTION_COLUMNS)
    .single();

  if (error || !data) return queryFailed();
  return { data: mapContribution(data as RawContribution), error: null };
}

export async function updateContribution(
  supabase: SupabaseClient,
  input: ContributionLocator & {
    contribution: NormalizedContributionInput;
  },
): Promise<GoalRepositoryResult<ContributionRecord | null>> {
  const { data, error } = await supabase
    .from("transactions")
    .update(contributionPayload(input.contribution))
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "contribution")
    .select(CONTRIBUTION_COLUMNS)
    .maybeSingle();

  if (error) return queryFailed();
  return {
    data: data ? mapContribution(data as RawContribution) : null,
    error: null,
  };
}

export async function deleteContribution(
  supabase: SupabaseClient,
  input: ContributionLocator,
): Promise<GoalRepositoryResult<boolean>> {
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "contribution")
    .select("id")
    .maybeSingle();

  if (error) return queryFailed();
  return { data: data !== null, error: null };
}

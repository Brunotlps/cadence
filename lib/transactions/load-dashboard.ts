import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthRange, resolveMonth } from "./civil-date";
import {
  getCurrentWorkspace,
  hasAnyTransactions,
  listMonthlyTransactions,
  type CurrentWorkspace,
  type TransactionRecord,
} from "./repository";
import {
  summarizeTransactions,
  type TransactionSummary,
} from "./summarize-transactions";

export type TransactionDashboardData = {
  workspace: CurrentWorkspace;
  month: string;
  transactions: TransactionRecord[];
  isWorkspaceEmpty: boolean;
  summary: TransactionSummary;
};

export type TransactionDashboardResult =
  | { status: "ready"; data: TransactionDashboardData }
  | { status: "no_workspace" }
  | { status: "error" };

export async function loadTransactionDashboard(
  supabase: SupabaseClient,
  userId: string,
  monthValue: string | string[] | undefined,
  now: Date = new Date(),
): Promise<TransactionDashboardResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const month = resolveMonth(monthValue, now);
  const range = getMonthRange(month);
  const transactionsResult = await listMonthlyTransactions(supabase, {
    workspaceId: workspaceResult.data.id,
    ...range,
  });
  if (transactionsResult.error) return { status: "error" };

  let isWorkspaceEmpty = false;
  if (transactionsResult.data.length === 0) {
    const existenceResult = await hasAnyTransactions(
      supabase,
      workspaceResult.data.id,
    );
    if (existenceResult.error) return { status: "error" };
    isWorkspaceEmpty = !existenceResult.data;
  }

  try {
    return {
      status: "ready",
      data: {
        workspace: workspaceResult.data,
        month,
        transactions: transactionsResult.data,
        isWorkspaceEmpty,
        summary: summarizeTransactions(transactionsResult.data),
      },
    };
  } catch {
    return { status: "error" };
  }
}

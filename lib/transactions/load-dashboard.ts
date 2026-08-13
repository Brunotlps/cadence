import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthRange, getTodayInSaoPaulo, resolveMonth } from "./civil-date";
import {
  hasAnyTransactions,
  listMonthlyTransactions,
  type TransactionRecord,
} from "./repository";
import {
  getCurrentWorkspace,
  type CurrentWorkspace,
} from "@/lib/workspace/repository";
import {
  deriveBillStatuses,
  type BillMonthStatus,
} from "@/lib/fixed-bills/derive-bill-status";
import { resolveDueDate } from "@/lib/fixed-bills/due-date";
import { listBillPayments, listFixedBills } from "@/lib/fixed-bills/repository";
import {
  summarizeTransactions,
  type TransactionSummary,
} from "./summarize-transactions";

export type PendingFixedBill = {
  id: string;
  name: string;
  dueOn: string;
  status: Extract<BillMonthStatus, "pending" | "due_soon" | "overdue">;
};

export type PaidFixedBill = {
  id: string;
  name: string;
  paidOn: string;
};

export type TransactionDashboardData = {
  workspace: CurrentWorkspace;
  month: string;
  transactions: TransactionRecord[];
  isWorkspaceEmpty: boolean;
  pendingFixedBills: PendingFixedBill[];
  paidFixedBills: PaidFixedBill[];
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
  const today = getTodayInSaoPaulo(now);
  const range = getMonthRange(month);
  const [transactionsResult, fixedBillsResult, billPaymentsResult] =
    await Promise.all([
      listMonthlyTransactions(supabase, {
        workspaceId: workspaceResult.data.id,
        ...range,
      }),
      listFixedBills(supabase, {
        workspaceId: workspaceResult.data.id,
        throughDate: resolveDueDate(31, month),
      }),
      listBillPayments(supabase, {
        workspaceId: workspaceResult.data.id,
        ...range,
      }),
    ]);
  if (transactionsResult.error || fixedBillsResult.error || billPaymentsResult.error) {
    return { status: "error" };
  }

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
    const derived = deriveBillStatuses(
      fixedBillsResult.data,
      billPaymentsResult.data,
      { month, today },
    );
    const pendingStatuses = new Set(["pending", "due_soon", "overdue"]);
    const billsWithStatus = fixedBillsResult.data.map((bill, index) => ({
      bill,
      status: derived[index],
    }));

    const pendingFixedBills: PendingFixedBill[] = billsWithStatus
      .filter(({ status }) => pendingStatuses.has(status.status))
      .map(({ bill, status }) => ({
        id: bill.id,
        name: bill.name,
        dueOn: status.dueOn,
        status: status.status as PendingFixedBill["status"],
      }))
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

    const paidFixedBills: PaidFixedBill[] = billsWithStatus
      .filter(({ status }) => status.status === "paid")
      .map(({ bill, status }) => ({
        id: bill.id,
        name: bill.name,
        paidOn: status.payments[0].occurredOn,
      }))
      .sort((a, b) => a.paidOn.localeCompare(b.paidOn));

    return {
      status: "ready",
      data: {
        workspace: workspaceResult.data,
        month,
        transactions: transactionsResult.data,
        isWorkspaceEmpty,
        pendingFixedBills,
        paidFixedBills,
        summary: summarizeTransactions(transactionsResult.data),
      },
    };
  } catch {
    return { status: "error" };
  }
}

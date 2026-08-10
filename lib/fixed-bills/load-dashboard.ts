import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMonthRange,
  getTodayInSaoPaulo,
  resolveMonth,
} from "@/lib/transactions/civil-date";
import {
  getCurrentWorkspace,
  type CurrentWorkspace,
} from "@/lib/workspace/repository";
import {
  deriveBillStatuses,
  type DerivedBillStatus,
} from "./derive-bill-status";
import { resolveDueDate } from "./due-date";
import {
  listBillPayments,
  listFixedBills,
  type BillPaymentRecord,
  type FixedBillRecord,
} from "./repository";

export type FixedBillFilter =
  | "todas"
  | "pendentes"
  | "pagas"
  | "automaticas";

export type FixedBillDashboardItem = FixedBillRecord &
  Omit<DerivedBillStatus<BillPaymentRecord>, "billId">;

export type FixedBillsDashboardData = {
  workspace: CurrentWorkspace;
  month: string;
  today: string;
  filter: FixedBillFilter;
  totalBillCount: number;
  bills: FixedBillDashboardItem[];
};

export type FixedBillsDashboardResult =
  | { status: "ready"; data: FixedBillsDashboardData }
  | { status: "no_workspace" }
  | { status: "error" };

const VALID_FILTERS = new Set<FixedBillFilter>([
  "todas",
  "pendentes",
  "pagas",
  "automaticas",
]);

export function resolveFixedBillFilter(
  value: string | string[] | undefined,
): FixedBillFilter {
  return typeof value === "string" && VALID_FILTERS.has(value as FixedBillFilter)
    ? (value as FixedBillFilter)
    : "todas";
}

function applyFilter(
  bills: FixedBillDashboardItem[],
  filter: FixedBillFilter,
): FixedBillDashboardItem[] {
  switch (filter) {
    case "pagas":
      return bills.filter((bill) => bill.status === "paid");
    case "pendentes":
      return bills.filter((bill) => bill.status !== "paid");
    case "automaticas":
      return bills.filter((bill) => bill.autopay);
    case "todas":
      return bills;
  }
}

export async function loadFixedBillsDashboard(
  supabase: SupabaseClient,
  userId: string,
  monthValue: string | string[] | undefined,
  filterValue: string | string[] | undefined,
  now: Date = new Date(),
): Promise<FixedBillsDashboardResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const month = resolveMonth(monthValue, now);
  const today = getTodayInSaoPaulo(now);
  const filter = resolveFixedBillFilter(filterValue);
  const range = getMonthRange(month);
  const [billsResult, paymentsResult] = await Promise.all([
    listFixedBills(supabase, {
      workspaceId: workspaceResult.data.id,
      throughDate: resolveDueDate(31, month),
    }),
    listBillPayments(supabase, {
      workspaceId: workspaceResult.data.id,
      ...range,
    }),
  ]);

  if (billsResult.error || paymentsResult.error) {
    return { status: "error" };
  }

  try {
    const derived = deriveBillStatuses(billsResult.data, paymentsResult.data, {
      month,
      today,
    });
    const bills = billsResult.data.map((bill, index) => {
      const { billId: _billId, ...status } = derived[index];
      void _billId;
      return { ...bill, ...status };
    });

    return {
      status: "ready",
      data: {
        workspace: workspaceResult.data,
        month,
        today,
        filter,
        totalBillCount: bills.length,
        bills: applyFilter(bills, filter),
      },
    };
  } catch {
    return { status: "error" };
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodayInSaoPaulo } from "@/lib/transactions/civil-date";
import {
  getCurrentWorkspace,
  type CurrentWorkspace,
} from "@/lib/workspace/repository";
import {
  getBillPaymentById,
  getFixedBillById,
  listFixedBills,
  type BillPaymentRecord,
  type FixedBillRecord,
} from "./repository";

export type FixedBillEditResult =
  | {
      status: "ready";
      data: { workspace: CurrentWorkspace; fixedBill: FixedBillRecord };
    }
  | { status: "no_workspace" }
  | { status: "error" };

export type BillPaymentEditResult =
  | {
      status: "ready";
      data: {
        workspace: CurrentWorkspace;
        payment: BillPaymentRecord;
        fixedBills: FixedBillRecord[];
      };
    }
  | { status: "no_workspace" }
  | { status: "error" };

export async function loadFixedBillForEdit(
  supabase: SupabaseClient,
  userId: string,
  fixedBillId: string,
): Promise<FixedBillEditResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const fixedBillResult = await getFixedBillById(supabase, {
    workspaceId: workspaceResult.data.id,
    fixedBillId,
  });
  if (fixedBillResult.error || !fixedBillResult.data) {
    return { status: "error" };
  }

  return {
    status: "ready",
    data: {
      workspace: workspaceResult.data,
      fixedBill: fixedBillResult.data,
    },
  };
}

export async function loadBillPaymentForEdit(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  now: Date = new Date(),
): Promise<BillPaymentEditResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const paymentResult = await getBillPaymentById(supabase, {
    workspaceId: workspaceResult.data.id,
    transactionId,
  });
  if (paymentResult.error || !paymentResult.data) {
    return { status: "error" };
  }

  const billsResult = await listFixedBills(supabase, {
    workspaceId: workspaceResult.data.id,
    throughDate: getTodayInSaoPaulo(now),
  });
  if (billsResult.error) return { status: "error" };

  return {
    status: "ready",
    data: {
      workspace: workspaceResult.data,
      payment: paymentResult.data,
      fixedBills: billsResult.data,
    },
  };
}

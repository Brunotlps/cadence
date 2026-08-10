import type { SupabaseClient } from "@supabase/supabase-js";
import { getTransactionById, type TransactionRecord } from "./repository";
import {
  getCurrentWorkspace,
  type CurrentWorkspace,
} from "@/lib/workspace/repository";

export type TransactionEditResult =
  | {
      status: "ready";
      data: {
        workspace: CurrentWorkspace;
        transaction: TransactionRecord;
      };
    }
  | { status: "no_workspace" }
  | { status: "error" };

export async function loadTransactionForEdit(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
): Promise<TransactionEditResult> {
  const workspaceResult = await getCurrentWorkspace(supabase, userId);
  if (workspaceResult.error) return { status: "error" };
  if (!workspaceResult.data) return { status: "no_workspace" };

  const transactionResult = await getTransactionById(supabase, {
    workspaceId: workspaceResult.data.id,
    transactionId,
  });

  if (
    transactionResult.error ||
    !transactionResult.data ||
    transactionResult.data.kind === "contribution" ||
    transactionResult.data.fixedBillId !== null
  ) {
    return { status: "error" };
  }

  return {
    status: "ready",
    data: {
      workspace: workspaceResult.data,
      transaction: transactionResult.data,
    },
  };
}

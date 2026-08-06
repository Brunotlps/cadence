"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveMonth } from "@/lib/transactions/civil-date";
import {
  deleteTransaction,
  getCurrentWorkspace,
  insertTransaction,
  updateTransaction,
} from "@/lib/transactions/repository";
import { validateTransactionInput } from "@/lib/transactions/validate-transaction";

const SAVE_ERROR = "Não foi possível salvar o lançamento.";
const DELETE_ERROR = "Não foi possível excluir o lançamento.";

export type TransactionActionState = {
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
): TransactionActionState {
  return { error, fieldErrors, success: false };
}

function success(): TransactionActionState {
  return { error: null, fieldErrors: {}, success: true };
}

function validateForm(formData: FormData) {
  return validateTransactionInput({
    amount: formData.get("amount"),
    category: formData.get("category"),
    occurredOn: formData.get("occurredOn"),
    description: formData.get("description"),
    paymentMethod: formData.get("paymentMethod"),
  });
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

export async function createTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_ERROR);

  const validation = validateForm(formData);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const result = await insertTransaction(context.supabase, {
    workspaceId: context.workspaceId,
    createdBy: context.userId,
    transaction: validation.data,
  });
  if (result.error) return failure(SAVE_ERROR);

  revalidatePath("/dashboard");
  return success();
}

export async function updateTransactionAction(
  transactionId: string,
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_ERROR);

  const validation = validateForm(formData);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const result = await updateTransaction(context.supabase, {
    workspaceId: context.workspaceId,
    transactionId,
    transaction: validation.data,
  });
  if (result.error || !result.data) return failure(SAVE_ERROR);

  const month = resolveMonth(
    typeof formData.get("month") === "string"
      ? (formData.get("month") as string)
      : undefined,
  );
  revalidatePath("/dashboard");
  redirect(`/dashboard?month=${month}`);
}

export async function deleteTransactionAction(
  transactionId: string,
  _prevState: TransactionActionState,
  _formData: FormData,
): Promise<TransactionActionState> {
  const context = await getActionContext();
  if (!context) return failure(DELETE_ERROR);

  const result = await deleteTransaction(context.supabase, {
    workspaceId: context.workspaceId,
    transactionId,
  });
  if (result.error || !result.data) return failure(DELETE_ERROR);

  revalidatePath("/dashboard");
  return success();
}

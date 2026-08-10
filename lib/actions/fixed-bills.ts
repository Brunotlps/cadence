"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  deleteBillPayment,
  deleteFixedBill,
  getFixedBillById,
  insertBillPayment,
  insertFixedBill,
  updateBillPayment,
  updateFixedBill,
} from "@/lib/fixed-bills/repository";
import { validateBillPaymentInput } from "@/lib/fixed-bills/validate-bill-payment";
import { validateFixedBillInput } from "@/lib/fixed-bills/validate-fixed-bill";
import { createClient } from "@/lib/supabase/server";
import { getTodayInSaoPaulo } from "@/lib/transactions/civil-date";
import { getCurrentWorkspace } from "@/lib/workspace/repository";

const SAVE_FIXED_BILL_ERROR = "Não foi possível salvar a conta fixa.";
const DELETE_FIXED_BILL_ERROR = "Não foi possível encerrar a conta fixa.";
const SAVE_PAYMENT_ERROR = "Não foi possível salvar o pagamento.";
const DELETE_PAYMENT_ERROR = "Não foi possível excluir o pagamento.";

export type FixedBillActionState = {
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
): FixedBillActionState {
  return { error, fieldErrors, success: false };
}

function success(): FixedBillActionState {
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

function validateFixedBillForm(formData: FormData) {
  return validateFixedBillInput({
    name: formData.get("name"),
    dueDay: formData.get("dueDay"),
    category: formData.get("category"),
    estimatedAmount: formData.get("estimatedAmount"),
    autopay: formData.get("autopay"),
    variableAmount: formData.get("variableAmount"),
  });
}

function validatePaymentForm(formData: FormData, fixedBillId: unknown) {
  return validateBillPaymentInput(
    {
      amount: formData.get("amount"),
      occurredOn: formData.get("occurredOn"),
      paymentMethod: formData.get("paymentMethod"),
      fixedBillId,
    },
    getTodayInSaoPaulo(),
  );
}

function revalidatePaymentPaths() {
  revalidatePath("/fixed-bills");
  revalidatePath("/dashboard");
}

export async function createFixedBillAction(
  _prevState: FixedBillActionState,
  formData: FormData,
): Promise<FixedBillActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_FIXED_BILL_ERROR);

  const validation = validateFixedBillForm(formData);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const result = await insertFixedBill(context.supabase, {
    workspaceId: context.workspaceId,
    fixedBill: validation.data,
  });
  if (result.error) return failure(SAVE_FIXED_BILL_ERROR);

  revalidatePath("/fixed-bills");
  return success();
}

export async function updateFixedBillAction(
  fixedBillId: string,
  _prevState: FixedBillActionState,
  formData: FormData,
): Promise<FixedBillActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_FIXED_BILL_ERROR);

  const validation = validateFixedBillForm(formData);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const result = await updateFixedBill(context.supabase, {
    workspaceId: context.workspaceId,
    fixedBillId,
    fixedBill: validation.data,
  });
  if (result.error || !result.data) return failure(SAVE_FIXED_BILL_ERROR);

  revalidatePath("/fixed-bills");
  return success();
}

export async function deleteFixedBillAction(
  fixedBillId: string,
  _prevState: FixedBillActionState,
  _formData: FormData,
): Promise<FixedBillActionState> {
  void _prevState;
  void _formData;

  const context = await getActionContext();
  if (!context) return failure(DELETE_FIXED_BILL_ERROR);

  const result = await deleteFixedBill(context.supabase, {
    workspaceId: context.workspaceId,
    fixedBillId,
  });
  if (result.error || !result.data) return failure(DELETE_FIXED_BILL_ERROR);

  revalidatePath("/fixed-bills");
  return success();
}

export async function createBillPaymentAction(
  fixedBillId: string,
  _prevState: FixedBillActionState,
  formData: FormData,
): Promise<FixedBillActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_PAYMENT_ERROR);

  const validation = validatePaymentForm(formData, fixedBillId);
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const billResult = await getFixedBillById(context.supabase, {
    workspaceId: context.workspaceId,
    fixedBillId,
  });
  if (billResult.error || !billResult.data) {
    return failure(SAVE_PAYMENT_ERROR);
  }

  const result = await insertBillPayment(context.supabase, {
    workspaceId: context.workspaceId,
    createdBy: context.userId,
    category: billResult.data.category,
    payment: validation.data,
  });
  if (result.error) return failure(SAVE_PAYMENT_ERROR);

  revalidatePaymentPaths();
  return success();
}

export async function updateBillPaymentAction(
  transactionId: string,
  _prevState: FixedBillActionState,
  formData: FormData,
): Promise<FixedBillActionState> {
  const context = await getActionContext();
  if (!context) return failure(SAVE_PAYMENT_ERROR);

  const validation = validatePaymentForm(
    formData,
    formData.get("fixedBillId"),
  );
  if (!validation.success) {
    return failure("Revise os campos destacados.", validation.fieldErrors);
  }

  const billResult = await getFixedBillById(context.supabase, {
    workspaceId: context.workspaceId,
    fixedBillId: validation.data.fixedBillId,
  });
  if (billResult.error || !billResult.data) {
    return failure(SAVE_PAYMENT_ERROR);
  }

  const result = await updateBillPayment(context.supabase, {
    workspaceId: context.workspaceId,
    transactionId,
    category: billResult.data.category,
    payment: validation.data,
  });
  if (result.error || !result.data) return failure(SAVE_PAYMENT_ERROR);

  revalidatePaymentPaths();
  return success();
}

export async function deleteBillPaymentAction(
  transactionId: string,
  _prevState: FixedBillActionState,
  _formData: FormData,
): Promise<FixedBillActionState> {
  void _prevState;
  void _formData;

  const context = await getActionContext();
  if (!context) return failure(DELETE_PAYMENT_ERROR);

  const result = await deleteBillPayment(context.supabase, {
    workspaceId: context.workspaceId,
    transactionId,
  });
  if (result.error || !result.data) return failure(DELETE_PAYMENT_ERROR);

  revalidatePaymentPaths();
  return success();
}

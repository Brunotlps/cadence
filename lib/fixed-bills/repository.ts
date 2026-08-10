import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionCategoryCode } from "@/lib/transactions/categories";
import type { PaymentMethodCode } from "@/lib/transactions/payment-methods";
import type { NormalizedBillPaymentInput } from "./validate-bill-payment";
import type { NormalizedFixedBillInput } from "./validate-fixed-bill";

const FIXED_BILL_COLUMNS =
  "id, name, due_day, category, autopay, variable_amount, estimated_amount, started_on, created_at";
const BILL_PAYMENT_COLUMNS =
  "id, fixed_bill_id, created_by, amount, payment_method, occurred_on, created_at";

export type FixedBillRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: "query_failed" };

export type FixedBillRecord = {
  id: string;
  name: string;
  dueDay: number;
  category: TransactionCategoryCode;
  autopay: boolean;
  variableAmount: boolean;
  estimatedAmount: string;
  startedOn: string;
  createdAt: string;
};

export type BillPaymentRecord = {
  id: string;
  fixedBillId: string;
  createdBy: string;
  amount: string;
  paymentMethod: PaymentMethodCode | null;
  occurredOn: string;
  createdAt: string;
};

type RawFixedBill = {
  id: string;
  name: string;
  due_day: number;
  category: TransactionCategoryCode;
  autopay: boolean;
  variable_amount: boolean;
  estimated_amount: string | number;
  started_on: string;
  created_at: string;
};

type RawBillPayment = {
  id: string;
  fixed_bill_id: string;
  created_by: string;
  amount: string | number;
  payment_method: PaymentMethodCode | null;
  occurred_on: string;
  created_at: string;
};

type FixedBillLocator = {
  workspaceId: string;
  fixedBillId: string;
};

type BillPaymentLocator = {
  workspaceId: string;
  transactionId: string;
};

function queryFailed<T>(): FixedBillRepositoryResult<T> {
  return { data: null, error: "query_failed" };
}

function mapFixedBill(row: RawFixedBill): FixedBillRecord {
  return {
    id: row.id,
    name: row.name,
    dueDay: row.due_day,
    category: row.category,
    autopay: row.autopay,
    variableAmount: row.variable_amount,
    estimatedAmount: String(row.estimated_amount),
    startedOn: row.started_on,
    createdAt: row.created_at,
  };
}

function mapBillPayment(row: RawBillPayment): BillPaymentRecord {
  return {
    id: row.id,
    fixedBillId: row.fixed_bill_id,
    createdBy: row.created_by,
    amount: String(row.amount),
    paymentMethod: row.payment_method,
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
  };
}

function fixedBillPayload(fixedBill: NormalizedFixedBillInput) {
  return {
    name: fixedBill.name,
    due_day: fixedBill.dueDay,
    category: fixedBill.category,
    autopay: fixedBill.autopay,
    variable_amount: fixedBill.variableAmount,
    estimated_amount: fixedBill.estimatedAmount,
  };
}

function billPaymentPayload(
  payment: NormalizedBillPaymentInput,
  category: TransactionCategoryCode,
) {
  return {
    amount: payment.amount,
    category,
    payment_method: payment.paymentMethod,
    goal_id: null,
    fixed_bill_id: payment.fixedBillId,
    occurred_on: payment.occurredOn,
  };
}

export async function listFixedBills(
  supabase: SupabaseClient,
  input: { workspaceId: string; throughDate: string },
): Promise<FixedBillRepositoryResult<FixedBillRecord[]>> {
  const { data, error } = await supabase
    .from("fixed_bills")
    .select(FIXED_BILL_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .lte("started_on", input.throughDate)
    .order("name", { ascending: true });

  if (error) return queryFailed();
  return {
    data: ((data ?? []) as RawFixedBill[]).map(mapFixedBill),
    error: null,
  };
}

export async function listBillPayments(
  supabase: SupabaseClient,
  input: { workspaceId: string; start: string; endExclusive: string },
): Promise<FixedBillRepositoryResult<BillPaymentRecord[]>> {
  const { data, error } = await supabase
    .from("transactions")
    .select(BILL_PAYMENT_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "expense")
    .not("fixed_bill_id", "is", null)
    .gte("occurred_on", input.start)
    .lt("occurred_on", input.endExclusive)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return queryFailed();
  return {
    data: ((data ?? []) as RawBillPayment[]).map(mapBillPayment),
    error: null,
  };
}

export async function getFixedBillById(
  supabase: SupabaseClient,
  input: FixedBillLocator,
): Promise<FixedBillRepositoryResult<FixedBillRecord | null>> {
  const { data, error } = await supabase
    .from("fixed_bills")
    .select(FIXED_BILL_COLUMNS)
    .eq("id", input.fixedBillId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) return queryFailed();
  return {
    data: data ? mapFixedBill(data as RawFixedBill) : null,
    error: null,
  };
}

export async function insertFixedBill(
  supabase: SupabaseClient,
  input: { workspaceId: string; fixedBill: NormalizedFixedBillInput },
): Promise<FixedBillRepositoryResult<FixedBillRecord>> {
  const { data, error } = await supabase
    .from("fixed_bills")
    .insert({
      workspace_id: input.workspaceId,
      ...fixedBillPayload(input.fixedBill),
    })
    .select(FIXED_BILL_COLUMNS)
    .single();

  if (error || !data) return queryFailed();
  return { data: mapFixedBill(data as RawFixedBill), error: null };
}

export async function updateFixedBill(
  supabase: SupabaseClient,
  input: FixedBillLocator & { fixedBill: NormalizedFixedBillInput },
): Promise<FixedBillRepositoryResult<FixedBillRecord | null>> {
  const { data, error } = await supabase
    .from("fixed_bills")
    .update(fixedBillPayload(input.fixedBill))
    .eq("id", input.fixedBillId)
    .eq("workspace_id", input.workspaceId)
    .select(FIXED_BILL_COLUMNS)
    .maybeSingle();

  if (error) return queryFailed();
  return {
    data: data ? mapFixedBill(data as RawFixedBill) : null,
    error: null,
  };
}

export async function deleteFixedBill(
  supabase: SupabaseClient,
  input: FixedBillLocator,
): Promise<FixedBillRepositoryResult<boolean>> {
  const { data, error } = await supabase
    .from("fixed_bills")
    .delete()
    .eq("id", input.fixedBillId)
    .eq("workspace_id", input.workspaceId)
    .select("id")
    .maybeSingle();

  if (error) return queryFailed();
  return { data: data !== null, error: null };
}

export async function getBillPaymentById(
  supabase: SupabaseClient,
  input: BillPaymentLocator,
): Promise<FixedBillRepositoryResult<BillPaymentRecord | null>> {
  const { data, error } = await supabase
    .from("transactions")
    .select(BILL_PAYMENT_COLUMNS)
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "expense")
    .not("fixed_bill_id", "is", null)
    .maybeSingle();

  if (error) return queryFailed();
  return {
    data: data ? mapBillPayment(data as RawBillPayment) : null,
    error: null,
  };
}

export async function insertBillPayment(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    createdBy: string;
    category: TransactionCategoryCode;
    payment: NormalizedBillPaymentInput;
  },
): Promise<FixedBillRepositoryResult<BillPaymentRecord>> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      kind: "expense",
      description: null,
      ...billPaymentPayload(input.payment, input.category),
    })
    .select(BILL_PAYMENT_COLUMNS)
    .single();

  if (error || !data) return queryFailed();
  return { data: mapBillPayment(data as RawBillPayment), error: null };
}

export async function updateBillPayment(
  supabase: SupabaseClient,
  input: BillPaymentLocator & {
    category: TransactionCategoryCode;
    payment: NormalizedBillPaymentInput;
  },
): Promise<FixedBillRepositoryResult<BillPaymentRecord | null>> {
  const { data, error } = await supabase
    .from("transactions")
    .update(billPaymentPayload(input.payment, input.category))
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "expense")
    .not("fixed_bill_id", "is", null)
    .select(BILL_PAYMENT_COLUMNS)
    .maybeSingle();

  if (error) return queryFailed();
  return {
    data: data ? mapBillPayment(data as RawBillPayment) : null,
    error: null,
  };
}

export async function deleteBillPayment(
  supabase: SupabaseClient,
  input: BillPaymentLocator,
): Promise<FixedBillRepositoryResult<boolean>> {
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .eq("kind", "expense")
    .not("fixed_bill_id", "is", null)
    .select("id")
    .maybeSingle();

  if (error) return queryFailed();
  return { data: data !== null, error: null };
}

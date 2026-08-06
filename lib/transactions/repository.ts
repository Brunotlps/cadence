import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransactionCategoryCode } from "./categories";
import type { TransactionKind } from "./kinds";
import type { PaymentMethodCode } from "./payment-methods";
import type { NormalizedTransactionInput } from "./validate-transaction";

const TRANSACTION_COLUMNS =
  "id, kind, amount, category, description, payment_method, occurred_on, created_at";

export type RepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: "query_failed" };

export type CurrentWorkspace = {
  id: string;
  name: string;
};

export type TransactionRecord = {
  id: string;
  kind: TransactionKind;
  amount: string;
  category: TransactionCategoryCode | null;
  description: string | null;
  paymentMethod: PaymentMethodCode | null;
  occurredOn: string;
  createdAt: string;
};

type RawTransaction = {
  id: string;
  kind: TransactionKind;
  amount: string | number;
  category: TransactionCategoryCode | null;
  description: string | null;
  payment_method: PaymentMethodCode | null;
  occurred_on: string;
  created_at: string;
};

type TransactionLocator = {
  workspaceId: string;
  transactionId: string;
};

type TransactionMutation = {
  transaction: NormalizedTransactionInput;
};

function queryFailed<T>(): RepositoryResult<T> {
  return { data: null, error: "query_failed" };
}

function mapTransaction(row: RawTransaction): TransactionRecord {
  return {
    id: row.id,
    kind: row.kind,
    amount: String(row.amount),
    category: row.category,
    description: row.description,
    paymentMethod: row.payment_method,
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
  };
}

function editablePayload(transaction: NormalizedTransactionInput) {
  return {
    kind: transaction.kind,
    amount: transaction.amount,
    category: transaction.category,
    description: transaction.description,
    payment_method: transaction.paymentMethod,
    occurred_on: transaction.occurredOn,
  };
}

export async function getCurrentWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<RepositoryResult<CurrentWorkspace | null>> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return queryFailed();
  if (!data) return { data: null, error: null };

  const membership = data as unknown as {
    workspace_id: string;
    workspaces: { name: string } | Array<{ name: string }> | null;
  };
  const workspace = Array.isArray(membership.workspaces)
    ? membership.workspaces[0]
    : membership.workspaces;

  if (!workspace) return queryFailed();

  return {
    data: { id: membership.workspace_id, name: workspace.name },
    error: null,
  };
}

export async function listMonthlyTransactions(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    start: string;
    endExclusive: string;
  },
): Promise<RepositoryResult<TransactionRecord[]>> {
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .gte("occurred_on", input.start)
    .lt("occurred_on", input.endExclusive)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return queryFailed();

  return {
    data: ((data ?? []) as RawTransaction[]).map(mapTransaction),
    error: null,
  };
}

export async function hasAnyTransactions(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<RepositoryResult<boolean>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) return queryFailed();

  return { data: (data ?? []).length > 0, error: null };
}

export async function getTransactionById(
  supabase: SupabaseClient,
  input: TransactionLocator,
): Promise<RepositoryResult<TransactionRecord | null>> {
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (error) return queryFailed();

  return {
    data: data ? mapTransaction(data as RawTransaction) : null,
    error: null,
  };
}

export async function insertTransaction(
  supabase: SupabaseClient,
  input: TransactionMutation & { workspaceId: string; createdBy: string },
): Promise<RepositoryResult<TransactionRecord>> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      ...editablePayload(input.transaction),
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error || !data) return queryFailed();

  return { data: mapTransaction(data as RawTransaction), error: null };
}

export async function updateTransaction(
  supabase: SupabaseClient,
  input: TransactionLocator & TransactionMutation,
): Promise<RepositoryResult<TransactionRecord | null>> {
  const { data, error } = await supabase
    .from("transactions")
    .update(editablePayload(input.transaction))
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .select(TRANSACTION_COLUMNS)
    .maybeSingle();

  if (error) return queryFailed();

  return {
    data: data ? mapTransaction(data as RawTransaction) : null,
    error: null,
  };
}

export async function deleteTransaction(
  supabase: SupabaseClient,
  input: TransactionLocator,
): Promise<RepositoryResult<boolean>> {
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", input.transactionId)
    .eq("workspace_id", input.workspaceId)
    .select("id")
    .maybeSingle();

  if (error) return queryFailed();

  return { data: data !== null, error: null };
}

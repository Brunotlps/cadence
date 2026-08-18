import type { SupabaseClient } from "@supabase/supabase-js";

const PROFILE_COLUMNS = "id, display_name, accent_color, created_at";
const WORKSPACE_COLUMNS = "id, name, created_at";
const WORKSPACE_MEMBER_COLUMNS = "workspace_id, user_id, role, created_at";
const TRANSACTION_COLUMNS =
  "id, workspace_id, created_by, kind, amount, category, description, payment_method, goal_id, fixed_bill_id, occurred_on, created_at";
const GOAL_COLUMNS =
  "id, workspace_id, name, target_amount, suggested_monthly, started_on, created_at";
const FIXED_BILL_COLUMNS =
  "id, workspace_id, name, due_day, category, autopay, variable_amount, estimated_amount, started_on, created_at";

export type DataPortabilityExport = {
  profile: {
    id: string;
    display_name: string | null;
    accent_color: string;
    created_at: string;
  } | null;
  workspaces: Array<{
    id: string;
    name: string;
    created_at: string;
  }>;
  workspace_members: Array<{
    workspace_id: string;
    user_id: string;
    role: string;
    created_at: string;
  }>;
  transactions: Array<{
    id: string;
    workspace_id: string;
    created_by: string;
    kind: string;
    amount: string;
    category: string | null;
    description: string | null;
    payment_method: string | null;
    goal_id: string | null;
    fixed_bill_id: string | null;
    occurred_on: string;
    created_at: string;
  }>;
  goals: Array<{
    id: string;
    workspace_id: string;
    name: string;
    target_amount: string;
    suggested_monthly: string | null;
    started_on: string;
    created_at: string;
  }>;
  fixed_bills: Array<{
    id: string;
    workspace_id: string;
    name: string;
    due_day: number;
    category: string;
    autopay: boolean;
    variable_amount: boolean;
    estimated_amount: string;
    started_on: string;
    created_at: string;
  }>;
};

export type DataPortabilityResult =
  | { data: DataPortabilityExport; error: null }
  | { data: null; error: "query_failed" };

type RawProfile = NonNullable<DataPortabilityExport["profile"]>;
type RawWorkspace = DataPortabilityExport["workspaces"][number];
type RawWorkspaceMember = DataPortabilityExport["workspace_members"][number];
type RawTransaction = Omit<DataPortabilityExport["transactions"][number], "amount"> & {
  amount: string | number;
};
type RawGoal = Omit<
  DataPortabilityExport["goals"][number],
  "target_amount" | "suggested_monthly"
> & {
  target_amount: string | number;
  suggested_monthly: string | number | null;
};
type RawFixedBill = Omit<
  DataPortabilityExport["fixed_bills"][number],
  "estimated_amount"
> & {
  estimated_amount: string | number;
};

function mapProfile(row: RawProfile): NonNullable<DataPortabilityExport["profile"]> {
  return {
    id: row.id,
    display_name: row.display_name,
    accent_color: row.accent_color,
    created_at: row.created_at,
  };
}

function mapWorkspace(row: RawWorkspace): DataPortabilityExport["workspaces"][number] {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

function mapWorkspaceMember(
  row: RawWorkspaceMember,
): DataPortabilityExport["workspace_members"][number] {
  return {
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
  };
}

function decimalString(value: string | number): string {
  if (typeof value === "number") return value.toFixed(2);

  const [integer, fractional = ""] = value.split(".");
  return `${integer}.${fractional.padEnd(2, "0")}`;
}

function mapTransaction(row: RawTransaction): DataPortabilityExport["transactions"][number] {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    created_by: row.created_by,
    kind: row.kind,
    amount: decimalString(row.amount),
    category: row.category,
    description: row.description,
    payment_method: row.payment_method,
    goal_id: row.goal_id,
    fixed_bill_id: row.fixed_bill_id,
    occurred_on: row.occurred_on,
    created_at: row.created_at,
  };
}

function mapGoal(row: RawGoal): DataPortabilityExport["goals"][number] {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    target_amount: decimalString(row.target_amount),
    suggested_monthly:
      row.suggested_monthly === null
        ? null
        : decimalString(row.suggested_monthly),
    started_on: row.started_on,
    created_at: row.created_at,
  };
}

function mapFixedBill(
  row: RawFixedBill,
): DataPortabilityExport["fixed_bills"][number] {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    due_day: row.due_day,
    category: row.category,
    autopay: row.autopay,
    variable_amount: row.variable_amount,
    estimated_amount: decimalString(row.estimated_amount),
    started_on: row.started_on,
    created_at: row.created_at,
  };
}

// Every workspace query deliberately relies on the authenticated client's RLS
// policies. There is no caller-supplied workspace or account target.
export async function exportUserData(
  supabase: SupabaseClient,
  userId: string,
): Promise<DataPortabilityResult> {
  const [profile, workspaces, workspaceMembers, transactions, goals, fixedBills] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("workspaces").select(WORKSPACE_COLUMNS).order("created_at"),
      supabase
        .from("workspace_members")
        .select(WORKSPACE_MEMBER_COLUMNS)
        .order("created_at"),
      supabase.from("transactions").select(TRANSACTION_COLUMNS).order("created_at"),
      supabase.from("goals").select(GOAL_COLUMNS).order("created_at"),
      supabase.from("fixed_bills").select(FIXED_BILL_COLUMNS).order("created_at"),
    ]);

  if (
    profile.error ||
    workspaces.error ||
    workspaceMembers.error ||
    transactions.error ||
    goals.error ||
    fixedBills.error
  ) {
    return { data: null, error: "query_failed" };
  }

  return {
    data: {
      profile:
        profile.data && (profile.data as RawProfile).id === userId
          ? mapProfile(profile.data as RawProfile)
          : null,
      workspaces: ((workspaces.data ?? []) as RawWorkspace[]).map(mapWorkspace),
      workspace_members: (
        (workspaceMembers.data ?? []) as RawWorkspaceMember[]
      ).map(mapWorkspaceMember),
      transactions: ((transactions.data ?? []) as RawTransaction[]).map(
        mapTransaction,
      ),
      goals: ((goals.data ?? []) as RawGoal[]).map(mapGoal),
      fixed_bills: ((fixedBills.data ?? []) as RawFixedBill[]).map(mapFixedBill),
    },
    error: null,
  };
}

import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres, { type Sql } from "postgres";
import { assertSupabaseProjectConsistency } from "@/lib/supabase/project-identity";
import {
  readMigrationManifest,
  type MigrationHistoryRecord,
  type MigrationManifestEntry,
} from "./migration-history";
import { repairMigrationHistory } from "./migration-history-repair";

config({ path: ".env.local", quiet: true });

const migrationsFolder = fileURLToPath(
  new URL("../db/migrations", import.meta.url),
);
const baselineTag = "0016_profiles_workspace_visibility";

const requiredTables = [
  "fixed_bills",
  "goals",
  "profiles",
  "transactions",
  "workspace_members",
  "workspaces",
  "workspace_invites",
  "feedback_submission_limits",
];

const requiredPolicies = [
  ["workspaces", "workspaces_select_member"],
  ["workspaces", "workspaces_update_member"],
  ["workspace_members", "workspace_members_select_member"],
  ["transactions", "transactions_select_member"],
  ["fixed_bills", "fixed_bills_select_member"],
  ["goals", "goals_select_member"],
  ["profiles", "profiles_select_own"],
  ["profiles", "profiles_select_workspace_members"],
  ["workspace_invites", "workspace_invites_select_member"],
] as const;

const requiredFunctions = [
  "public.is_workspace_member(uuid)",
  "public.create_workspace_with_owner(text)",
  "public.handle_new_user()",
  "public.handle_account_deletion(uuid)",
  "public.protect_transaction_ownership_fields()",
  "public.protect_goal_system_fields()",
  "public.validate_contribution_goal_on_insert()",
  "public.validate_contribution_goal_on_update()",
  "public.protect_fixed_bill_system_fields()",
  "public.validate_fixed_bill_link()",
  "public.create_workspace_invite(uuid)",
  "public.redeem_workspace_invite(uuid)",
  "public.consume_feedback_submission_limit()",
  "public.cleanup_expired_feedback_submission_limits()",
];

const requiredTriggers = [
  ["auth", "users", "on_auth_user_created"],
  ["public", "transactions", "protect_transaction_ownership_fields"],
  ["public", "goals", "protect_goal_system_fields"],
  ["public", "goals", "validate_contribution_goal_on_insert"],
  ["public", "goals", "validate_contribution_goal_on_update"],
  ["public", "fixed_bills", "protect_fixed_bill_system_fields"],
  ["public", "transactions", "validate_fixed_bill_link_on_insert"],
  ["public", "transactions", "validate_fixed_bill_link_on_update"],
] as const;

type Queryable = Pick<Sql, "unsafe">;

async function verifySchema(sql: Queryable, baseline: MigrationManifestEntry) {
  if (baseline.tag !== baselineTag) {
    throw new Error(`schema preflight only supports ${baselineTag}.`);
  }

  for (const table of requiredTables) {
    const rows = await sql.unsafe<{ exists: boolean }[]>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [`public.${table}`],
    );
    if (!rows[0]?.exists) throw new Error(`schema preflight missing table public.${table}.`);
  }

  const rlsRows = await sql.unsafe<{ relname: string; relrowsecurity: boolean }[]>(
    `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [requiredTables],
  );
  const rlsByName = new Map(rlsRows.map((row) => [row.relname, row.relrowsecurity]));
  for (const table of requiredTables) {
    if (!rlsByName.get(table)) throw new Error(`schema preflight missing RLS on public.${table}.`);
  }

  for (const [table, policy] of requiredPolicies) {
    const rows = await sql.unsafe<{ exists: boolean }[]>(
      "SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = $1 AND policyname = $2) AS exists",
      [table, policy],
    );
    if (!rows[0]?.exists) throw new Error(`schema preflight missing policy ${table}/${policy}.`);
  }

  for (const signature of requiredFunctions) {
    const rows = await sql.unsafe<{ exists: string | null }[]>(
      "SELECT to_regprocedure($1)::text AS exists",
      [signature],
    );
    if (!rows[0]?.exists) throw new Error(`schema preflight missing function ${signature}.`);
  }

  for (const [schema, table, trigger] of requiredTriggers) {
    const rows = await sql.unsafe<{ exists: boolean }[]>(
      "SELECT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = $2 AND t.tgname = $3 AND NOT t.tgisinternal) AS exists",
      [schema, table, trigger],
    );
    if (!rows[0]?.exists) throw new Error(`schema preflight missing trigger ${table}/${trigger}.`);
  }
}

function createStore(sql: Queryable) {
  return {
    read: async (): Promise<MigrationHistoryRecord[]> => {
      const rows = await sql.unsafe<MigrationHistoryRecord[]>(
        "SELECT hash, created_at AS \"createdAt\" FROM drizzle.__drizzle_migrations ORDER BY created_at ASC, id ASC",
      );
      return rows;
    },
    insert: async (entries: MigrationManifestEntry[]) => {
      for (const entry of entries) {
        await sql.unsafe(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [entry.hash, entry.createdAt],
        );
      }
    },
  };
}

const directUrl = process.env.DIRECT_URL;
if (!directUrl) throw new Error("DIRECT_URL is not set.");
assertSupabaseProjectConsistency({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  directUrl,
});

const dryRun = !process.argv.includes("--apply");
const sql = postgres(directUrl, { max: 1 });
try {
  const manifest = readMigrationManifest(migrationsFolder);
  await sql.begin(async (transaction) => {
    await transaction.unsafe("LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE");
    const store = createStore(transaction);
    await repairMigrationHistory({
      manifest,
      baselineTag,
      dryRun,
      store,
      verifySchema: (baseline) => verifySchema(transaction, baseline),
      write: (message) => process.stdout.write(message),
    });
  });
} finally {
  await sql.end();
}

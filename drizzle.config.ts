import { defineConfig } from "drizzle-kit";
import { assertSupabaseProjectConsistency } from "./lib/supabase/project-identity";

if (!process.env.DIRECT_URL) {
  throw new Error(
    "DIRECT_URL is not set. Migrations must run against a direct connection, " +
      "not the transaction pooler used by the app at runtime.",
  );
}

assertSupabaseProjectConsistency({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  directUrl: process.env.DIRECT_URL,
});

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
});

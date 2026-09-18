import { config } from "dotenv";
import postgres from "postgres";
import { describe, it, expect } from "vitest";
import { assertSupabaseProjectConsistency } from "@/lib/supabase/project-identity";

config({ path: ".env.local", quiet: true });

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
if (hasDatabaseUrl) {
  assertSupabaseProjectConsistency({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    databaseUrl: process.env.DATABASE_URL,
  });
}

// Roda só quando DATABASE_URL está definido localmente (.env.local).
// No CI, sem o secret configurado, o teste é pulado em vez de falhar.
describe.skipIf(!hasDatabaseUrl)("Conectividade com o Supabase", () => {
  it(
    "responde a uma query simples",
    async () => {
      const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
      try {
        const [row] = await sql`select 1 as ping`;
        expect(row.ping).toBe(1);
      } finally {
        await sql.end();
      }
    },
    15000,
  );
});

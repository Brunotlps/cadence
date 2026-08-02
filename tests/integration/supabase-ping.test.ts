import { config } from "dotenv";
import postgres from "postgres";
import { describe, it, expect } from "vitest";

config({ path: ".env.local", quiet: true });

// Roda só quando DATABASE_URL está definido localmente (.env.local).
// No CI, sem o secret configurado, o teste é pulado em vez de falhar.
describe.skipIf(!process.env.DATABASE_URL)("Conectividade com o Supabase", () => {
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

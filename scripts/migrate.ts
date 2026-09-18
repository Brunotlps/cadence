import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { runMigrationCommand } from "./migration-command";

config({ path: ".env.local", quiet: true });

const migrationsFolder = fileURLToPath(
  new URL("../db/migrations", import.meta.url),
);

const exitCode = await runMigrationCommand({
  environment: {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  createTask: (directUrl) => {
    const sql = postgres(directUrl, {
      max: 1,
    });
    const database = drizzle(sql);

    return {
      apply: () => migrate(database, { migrationsFolder }),
      close: () => sql.end(),
    };
  },
});

process.exitCode = exitCode;

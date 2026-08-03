import { defineConfig } from "drizzle-kit";

if (!process.env.DIRECT_URL) {
  throw new Error(
    "DIRECT_URL is not set. Migrations must run against a direct connection, " +
      "not the transaction pooler used by the app at runtime.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
});

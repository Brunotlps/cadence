import { afterEach, describe, expect, it, vi } from "vitest";

const PROJECT_REF = "abcdefghijklmnopqrst";
const OTHER_PROJECT_REF = "zyxwvutsrqponmlkjihg";

function setMigrationEnvironment(projectRef: string, databaseProjectRef: string) {
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    `https://${projectRef}.supabase.co`,
  );
  vi.stubEnv(
    "DIRECT_URL",
    `postgresql://postgres.${databaseProjectRef}:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
  );
}

async function loadDrizzleConfig() {
  vi.resetModules();
  return import("../../../drizzle.config");
}

describe("Drizzle environment guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("loads when the API and migration connection target the same project", async () => {
    setMigrationEnvironment(PROJECT_REF, PROJECT_REF);

    await expect(loadDrizzleConfig()).resolves.toBeDefined();
  });

  it("fails before migration when the connection targets another project", async () => {
    setMigrationEnvironment(PROJECT_REF, OTHER_PROJECT_REF);

    await expect(loadDrizzleConfig()).rejects.toThrow(
      `NEXT_PUBLIC_SUPABASE_URL targets project ${PROJECT_REF}, but DIRECT_URL targets project ${OTHER_PROJECT_REF}`,
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { runMigrationCommand } from "@/scripts/migration-command";

const PROJECT_REF = "abcdefghijklmnopqrst";
const OTHER_PROJECT_REF = "zyxwvutsrqponmlkjihg";
const PASSWORD = "migration-secret";
const DIRECT_URL =
  `postgresql://postgres.${PROJECT_REF}:${PASSWORD}` +
  "@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

function createHarness() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const apply = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  const createTask = vi.fn(() => ({ apply, close }));

  return {
    stdout,
    stderr,
    apply,
    close,
    createTask,
    options: {
      environment: {
        supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
        directUrl: DIRECT_URL,
      },
      createTask,
      writeStdout: (message: string) => stdout.push(message),
      writeStderr: (message: string) => stderr.push(message),
    },
  };
}

describe("migration command", () => {
  it("applies migrations, closes the connection, and exits successfully", async () => {
    const harness = createHarness();

    const exitCode = await runMigrationCommand(harness.options);

    expect(exitCode).toBe(0);
    expect(harness.createTask).toHaveBeenCalledWith(DIRECT_URL);
    expect(harness.apply).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledOnce();
    expect(harness.stdout).toEqual(["Migrations applied successfully.\n"]);
    expect(harness.stderr).toEqual([]);
  });

  it("prints actionable PostgreSQL failure details to stderr", async () => {
    const harness = createHarness();
    harness.apply.mockRejectedValueOnce(
      Object.assign(new Error('relation "fixed_bills" already exists'), {
        code: "42P07",
        detail: "A relation with this name is already present.",
        hint: "Reconcile the migration journal before retrying.",
      }),
    );

    const exitCode = await runMigrationCommand(harness.options);
    const output = harness.stderr.join("");

    expect(exitCode).toBe(1);
    expect(output).toContain("Migration failed");
    expect(output).toContain('relation "fixed_bills" already exists');
    expect(output).toContain("PostgreSQL code: 42P07");
    expect(output).toContain("A relation with this name is already present.");
    expect(output).toContain("Reconcile the migration journal before retrying.");
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it("prints nested causes without exposing connection credentials", async () => {
    const harness = createHarness();
    harness.apply.mockRejectedValueOnce(
      new Error(`Migration request failed for ${DIRECT_URL}`, {
        cause: new Error(`password authentication failed for ${PASSWORD}`),
      }),
    );

    const exitCode = await runMigrationCommand(harness.options);
    const output = harness.stderr.join("");

    expect(exitCode).toBe(1);
    expect(output).toContain("Caused by: password authentication failed");
    expect(output).not.toContain(DIRECT_URL);
    expect(output).not.toContain(PASSWORD);
    expect(output).toContain("[REDACTED]");
  });

  it("rejects a project mismatch before creating a connection", async () => {
    const harness = createHarness();
    harness.options.environment.directUrl = DIRECT_URL.replace(
      PROJECT_REF,
      OTHER_PROJECT_REF,
    );

    const exitCode = await runMigrationCommand(harness.options);

    expect(exitCode).toBe(1);
    expect(harness.createTask).not.toHaveBeenCalled();
    expect(harness.stderr.join("")).toContain("Supabase project mismatch");
  });

  it("reports connection cleanup failures as command failures", async () => {
    const harness = createHarness();
    harness.close.mockRejectedValueOnce(new Error("socket close failed"));

    const exitCode = await runMigrationCommand(harness.options);

    expect(exitCode).toBe(1);
    expect(harness.stderr.join("")).toContain(
      "Failed to close migration connection: socket close failed",
    );
  });
});

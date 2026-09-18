import { assertSupabaseProjectConsistency } from "@/lib/supabase/project-identity";

type MigrationEnvironment = {
  supabaseUrl?: string;
  directUrl?: string;
};

type MigrationTask = {
  apply: () => Promise<void>;
  close: () => Promise<void>;
};

type MigrationCommandOptions = {
  environment: MigrationEnvironment;
  createTask: (directUrl: string) => MigrationTask;
  writeStdout?: (message: string) => void;
  writeStderr?: (message: string) => void;
};

const ERROR_METADATA_FIELDS = [
  ["code", "PostgreSQL code"],
  ["detail", "Detail"],
  ["hint", "Hint"],
] as const;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function collectSensitiveValues(directUrl?: string): string[] {
  if (!directUrl) return [];

  const sensitiveValues = new Set([directUrl]);
  try {
    const parsedUrl = new URL(directUrl);
    if (parsedUrl.password) {
      sensitiveValues.add(parsedUrl.password);
      try {
        sensitiveValues.add(decodeURIComponent(parsedUrl.password));
      } catch {
        // The encoded password is still redacted even when decoding fails.
      }
    }
  } catch {
    // The consistency guard reports invalid URLs; retain the raw value for redaction.
  }

  return [...sensitiveValues]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
}

function redact(value: string, sensitiveValues: string[]): string {
  return sensitiveValues.reduce(
    (redacted, sensitiveValue) =>
      redacted.replaceAll(sensitiveValue, "[REDACTED]"),
    value,
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  const record = asRecord(error);
  if (typeof record?.message === "string") return record.message;
  if (typeof error === "string") return error;
  return "Unknown error.";
}

function formatErrorLines(
  label: string,
  error: unknown,
  sensitiveValues: string[],
  seen: Set<unknown>,
): string[] {
  if (seen.has(error)) return [`${label}: [circular error cause]`];
  seen.add(error);

  const lines = [`${label}: ${redact(errorMessage(error), sensitiveValues)}`];
  const record = asRecord(error);

  for (const [field, fieldLabel] of ERROR_METADATA_FIELDS) {
    const value = record?.[field];
    if (typeof value === "string" || typeof value === "number") {
      lines.push(`${fieldLabel}: ${redact(String(value), sensitiveValues)}`);
    }
  }

  if (record?.cause !== undefined) {
    lines.push(
      ...formatErrorLines(
        "Caused by",
        record.cause,
        sensitiveValues,
        seen,
      ),
    );
  }

  return lines;
}

export function formatMigrationError(
  label: string,
  error: unknown,
  sensitiveValues: string[],
): string {
  return `${formatErrorLines(label, error, sensitiveValues, new Set()).join("\n")}\n`;
}

export async function runMigrationCommand({
  environment,
  createTask,
  writeStdout = (message) => process.stdout.write(message),
  writeStderr = (message) => process.stderr.write(message),
}: MigrationCommandOptions): Promise<number> {
  const sensitiveValues = collectSensitiveValues(environment.directUrl);
  let task: MigrationTask | undefined;
  let exitCode = 0;

  try {
    if (!environment.directUrl) {
      throw new Error(
        "DIRECT_URL is not set. Migrations require a direct or session-pooler connection.",
      );
    }

    assertSupabaseProjectConsistency({
      supabaseUrl: environment.supabaseUrl,
      directUrl: environment.directUrl,
    });

    task = createTask(environment.directUrl);
    await task.apply();
    writeStdout("Migrations applied successfully.\n");
  } catch (error) {
    writeStderr(
      formatMigrationError(
        "Migration failed",
        error,
        sensitiveValues,
      ),
    );
    exitCode = 1;
  } finally {
    if (task) {
      try {
        await task.close();
      } catch (error) {
        writeStderr(
          formatMigrationError(
            "Failed to close migration connection",
            error,
            sensitiveValues,
          ),
        );
        exitCode = 1;
      }
    }
  }

  return exitCode;
}

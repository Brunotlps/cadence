import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";

export type MigrationManifestEntry = {
  index: number;
  tag: string;
  createdAt: number;
  hash: string;
};

export type MigrationHistoryRecord = {
  createdAt: number | string;
  hash: string;
};

export type MigrationHistoryInspection = {
  status: "fresh" | "consistent" | "invalid";
  appliedCount: number;
  issues: string[];
};

function readJournal(migrationsFolder: string) {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");
  const parsed = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries?: Array<{
      idx?: number;
      tag?: string;
      when?: number;
    }>;
  };

  if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
    throw new Error("Migration journal has no entries.");
  }

  return parsed.entries;
}

export function readMigrationManifest(
  migrationsFolder: string,
): MigrationManifestEntry[] {
  const journalEntries = readJournal(migrationsFolder);
  const migrations = readMigrationFiles({ migrationsFolder });

  if (journalEntries.length !== migrations.length) {
    throw new Error(
      `Migration journal has ${journalEntries.length} entries, but Drizzle read ${migrations.length} files.`,
    );
  }

  return journalEntries.map((entry, index) => {
    if (
      entry.idx !== index ||
      typeof entry.tag !== "string" ||
      typeof entry.when !== "number" ||
      !Number.isSafeInteger(entry.when)
    ) {
      throw new Error(`Migration journal entry ${index} is malformed.`);
    }

    if (index > 0 && entry.when <= journalEntries[index - 1].when!) {
      throw new Error(
        `Migration journal timestamp for ${entry.tag} is not strictly increasing.`,
      );
    }

    return {
      index,
      tag: entry.tag,
      createdAt: entry.when,
      hash: migrations[index].hash,
    };
  });
}

function normalizeRecord(record: MigrationHistoryRecord): MigrationHistoryRecord {
  const createdAt = Number(record.createdAt);
  if (!Number.isSafeInteger(createdAt) || typeof record.hash !== "string") {
    throw new Error("Migration history contains a malformed record.");
  }

  return { createdAt, hash: record.hash };
}

export function inspectMigrationHistory(
  manifest: MigrationManifestEntry[],
  records: MigrationHistoryRecord[],
): MigrationHistoryInspection {
  const issues: string[] = [];
  const expectedByTimestamp = new Map(
    manifest.map((entry) => [entry.createdAt, entry]),
  );
  const normalizedRecords: MigrationHistoryRecord[] = [];

  try {
    normalizedRecords.push(...records.map(normalizeRecord));
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Malformed record.");
  }

  const seenTimestamps = new Set<number>();
  const seenIndexes: number[] = [];

  for (const record of normalizedRecords) {
    const createdAt = Number(record.createdAt);
    if (seenTimestamps.has(createdAt)) {
      issues.push(`Duplicate migration history timestamp ${createdAt}.`);
      continue;
    }
    seenTimestamps.add(createdAt);

    const expected = expectedByTimestamp.get(createdAt);
    if (!expected) {
      issues.push(`Unknown migration history timestamp ${createdAt}.`);
      continue;
    }
    if (expected.hash !== record.hash) {
      issues.push(`Hash mismatch for migration ${expected.tag}.`);
      continue;
    }
    seenIndexes.push(expected.index);
  }

  seenIndexes.sort((left, right) => left - right);
  for (let index = 0; index < seenIndexes.length; index += 1) {
    if (seenIndexes[index] !== index) {
      issues.push(
        `Migration history has a gap before journal entry ${seenIndexes[index]}.`,
      );
      break;
    }
  }

  if (issues.length > 0) {
    return { status: "invalid", appliedCount: seenIndexes.length, issues };
  }

  return {
    status: seenIndexes.length === 0 ? "fresh" : "consistent",
    appliedCount: seenIndexes.length,
    issues: [],
  };
}

export function buildMigrationRepairPlan(
  manifest: MigrationManifestEntry[],
  records: MigrationHistoryRecord[],
  baselineTag: string,
): MigrationManifestEntry[] {
  const baseline = manifest.find((entry) => entry.tag === baselineTag);
  if (!baseline) {
    throw new Error(`cannot repair migration history: unknown baseline ${baselineTag}`);
  }

  const inspection = inspectMigrationHistory(manifest, records);
  if (inspection.status === "invalid") {
    throw new Error(
      `cannot repair migration history: ${inspection.issues.join(" ")}`,
    );
  }

  if (inspection.appliedCount > baseline.index + 1) {
    throw new Error(
      `cannot repair migration history: database is ahead of baseline ${baselineTag}`,
    );
  }

  return manifest.slice(inspection.appliedCount, baseline.index + 1);
}

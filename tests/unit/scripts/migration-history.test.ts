import { describe, expect, it } from "vitest";
import {
  buildMigrationRepairPlan,
  inspectMigrationHistory,
  readMigrationManifest,
  type MigrationHistoryRecord,
} from "@/scripts/migration-history";

const MIGRATIONS_FOLDER = `${process.cwd()}/db/migrations`;

describe("migration history manifest", () => {
  it("derives ordered tags, journal timestamps, and Drizzle hashes", () => {
    const manifest = readMigrationManifest(MIGRATIONS_FOLDER);

    expect(manifest).toHaveLength(17);
    expect(manifest[0]).toMatchObject({
      index: 0,
      tag: "0000_worried_moondragon",
      createdAt: 1785714577247,
      hash: "cd4137bef6be371f0f7471e3bbdb09659c31d0b51bf74facdfe9d49fa0f32f76",
    });
    expect(manifest.at(-1)).toMatchObject({
      index: 16,
      tag: "0016_profiles_workspace_visibility",
      createdAt: 1787841271461,
      hash: "e01678a4ddd146cd7e71564bcf08e2ca24d3c88a4710ecb54ebaecaf597bb437",
    });
  });
});

describe("migration history inspection", () => {
  it("accepts a fresh database and a complete ordered prefix", () => {
    const manifest = readMigrationManifest(MIGRATIONS_FOLDER);

    expect(inspectMigrationHistory(manifest, [])).toMatchObject({
      status: "fresh",
      appliedCount: 0,
      issues: [],
    });

    const prefix = manifest.slice(0, 2).map(({ createdAt, hash }) => ({
      createdAt,
      hash,
    }));

    expect(inspectMigrationHistory(manifest, prefix)).toMatchObject({
      status: "consistent",
      appliedCount: 2,
      issues: [],
    });
  });

  it("rejects gaps, unknown timestamps, duplicate rows, and hash drift", () => {
    const manifest = readMigrationManifest(MIGRATIONS_FOLDER);
    const records = manifest.slice(0, 2).map(({ createdAt, hash }) => ({
      createdAt,
      hash,
    }));

    const cases: MigrationHistoryRecord[][] = [
      [records[1]],
      [{ createdAt: 1, hash: records[0].hash }],
      [records[0], records[0]],
      [{ createdAt: records[0].createdAt, hash: "wrong-hash" }],
    ];

    for (const actual of cases) {
      expect(inspectMigrationHistory(manifest, actual).status).toBe("invalid");
    }
  });
});

describe("migration history repair plan", () => {
  it("plans only missing rows through the approved baseline using journal timestamps", () => {
    const manifest = readMigrationManifest(MIGRATIONS_FOLDER);
    const existing = manifest.slice(0, 2).map(({ createdAt, hash }) => ({
      createdAt,
      hash,
    }));

    const plan = buildMigrationRepairPlan(
      manifest,
      existing,
      "0016_profiles_workspace_visibility",
    );

    expect(plan.map(({ index, createdAt }) => ({ index, createdAt }))).toEqual(
      manifest.slice(2).map(({ index, createdAt }) => ({ index, createdAt })),
    );
  });

  it("does not permit an unknown or conflicting record to be marked applied", () => {
    const manifest = readMigrationManifest(MIGRATIONS_FOLDER);
    const conflicting = [
      { createdAt: manifest[0].createdAt, hash: "wrong-hash" },
    ];

    expect(() =>
      buildMigrationRepairPlan(
        manifest,
        conflicting,
        "0016_profiles_workspace_visibility",
      ),
    ).toThrow("cannot repair migration history");
  });
});

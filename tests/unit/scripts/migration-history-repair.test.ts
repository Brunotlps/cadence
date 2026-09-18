import { describe, expect, it, vi } from "vitest";
import {
  repairMigrationHistory,
  type MigrationHistoryStore,
} from "@/scripts/migration-history-repair";
import { readMigrationManifest } from "@/scripts/migration-history";

const manifest = readMigrationManifest(`${process.cwd()}/db/migrations`);
const baselineTag = "0016_profiles_workspace_visibility";

function storeWith(records: { createdAt: number; hash: string }[]): MigrationHistoryStore {
  return { read: vi.fn(async () => records), insert: vi.fn(async () => {}) };
}

describe("repairMigrationHistory", () => {
  it("dry-runs after schema verification without inserting", async () => {
    const store = storeWith(manifest.slice(0, 2));
    const verifySchema = vi.fn(async () => {});
    const write = vi.fn();

    const plan = await repairMigrationHistory({
      manifest,
      baselineTag,
      dryRun: true,
      store,
      verifySchema,
      write,
    });

    expect(plan).toHaveLength(15);
    expect(verifySchema).toHaveBeenCalledWith(manifest[16]);
    expect(store.insert).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });

  it("inserts the exact journal-backed plan only after verification", async () => {
    const store = storeWith(manifest.slice(0, 2));
    const verifySchema = vi.fn(async () => {});

    await repairMigrationHistory({
      manifest,
      baselineTag,
      dryRun: false,
      store,
      verifySchema,
      write: vi.fn(),
    });

    expect(store.insert).toHaveBeenCalledWith(manifest.slice(2));
  });

  it("does not insert when schema verification fails", async () => {
    const store = storeWith(manifest.slice(0, 2));
    const verifySchema = vi.fn(async () => {
      throw new Error("schema is incomplete");
    });

    await expect(
      repairMigrationHistory({
        manifest,
        baselineTag,
        dryRun: false,
        store,
        verifySchema,
        write: vi.fn(),
      }),
    ).rejects.toThrow("schema is incomplete");
    expect(store.insert).not.toHaveBeenCalled();
  });

  it("does not insert when history is already repaired", async () => {
    const store = storeWith(manifest);
    const verifySchema = vi.fn(async () => {});

    const plan = await repairMigrationHistory({
      manifest,
      baselineTag,
      dryRun: false,
      store,
      verifySchema,
      write: vi.fn(),
    });

    expect(plan).toEqual([]);
    expect(store.insert).not.toHaveBeenCalled();
  });
});

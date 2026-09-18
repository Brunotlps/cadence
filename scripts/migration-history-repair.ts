import type {
  MigrationHistoryRecord,
  MigrationManifestEntry,
} from "./migration-history";
import { buildMigrationRepairPlan } from "./migration-history";

export type MigrationHistoryStore = {
  read: () => Promise<MigrationHistoryRecord[]>;
  insert: (entries: MigrationManifestEntry[]) => Promise<void>;
};

export type MigrationHistoryRepairOptions = {
  manifest: MigrationManifestEntry[];
  baselineTag: string;
  dryRun: boolean;
  store: MigrationHistoryStore;
  verifySchema: (baseline: MigrationManifestEntry) => Promise<void>;
  write: (message: string) => void;
};

export async function repairMigrationHistory({
  manifest,
  baselineTag,
  dryRun,
  store,
  verifySchema,
  write,
}: MigrationHistoryRepairOptions): Promise<MigrationManifestEntry[]> {
  const baseline = manifest.find((entry) => entry.tag === baselineTag);
  if (!baseline) {
    throw new Error(`cannot repair migration history: unknown baseline ${baselineTag}`);
  }

  const records = await store.read();
  const plan = buildMigrationRepairPlan(manifest, records, baselineTag);
  await verifySchema(baseline);

  if (plan.length === 0) {
    write(`Migration history already reaches ${baselineTag}.\n`);
    return plan;
  }

  if (dryRun) {
    write(
      `Dry run: would record ${plan.length} migration(s) through ${baselineTag}.\n`,
    );
    return plan;
  }

  await store.insert(plan);
  write(`Recorded ${plan.length} migration(s) through ${baselineTag}.\n`);
  return plan;
}

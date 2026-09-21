import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageLock = {
  packages: Record<string, { version?: string }>;
};

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
};

function readJson<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), fileName), "utf8"),
  ) as T;
}

function expectVersionAtLeast(actual: string | undefined, minimum: string) {
  expect(actual, `expected a resolved version at or above ${minimum}`).toBeDefined();

  const actualParts = actual!.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (actualParts[index] !== minimumParts[index]) {
      expect(actualParts[index]).toBeGreaterThan(minimumParts[index]);
      return;
    }
  }
}

describe("dependency security resolutions", () => {
  const manifest = readJson<PackageManifest>("package.json");
  const lockfile = readJson<PackageLock>("package-lock.json");

  it("keeps Next and its ESLint config on the same patched release", () => {
    expect(manifest.dependencies?.next).toBe("16.3.5");
    expect(manifest.devDependencies?.["eslint-config-next"]).toBe("16.3.5");
    expectVersionAtLeast(lockfile.packages["node_modules/next"]?.version, "16.3.3");
  });

  it("lets patched Next resolve a safe Sharp release without a stale override", () => {
    expect(manifest.overrides?.sharp).toBeUndefined();
    expectVersionAtLeast(lockfile.packages["node_modules/sharp"]?.version, "0.35.4");
  });

  it.each([
    ["node_modules/js-yaml", "4.3.2"],
    ["node_modules/nanoid", "3.3.18"],
    ["node_modules/vitest", "4.1.11"],
  ])("keeps %s at or above %s", (packagePath, minimum) => {
    expectVersionAtLeast(lockfile.packages[packagePath]?.version, minimum);
  });

  it("keeps every resolved Vitest mocker outside the vulnerable range", () => {
    const mockerVersions = Object.entries(lockfile.packages)
      .filter(([packagePath]) => packagePath.endsWith("node_modules/@vitest/mocker"))
      .map(([, packageEntry]) => packageEntry.version);

    expect(mockerVersions.length).toBeGreaterThan(0);
    for (const version of mockerVersions) {
      expectVersionAtLeast(version, "4.1.11");
    }
  });
});

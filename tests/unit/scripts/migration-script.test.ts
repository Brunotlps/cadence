import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackageManifest(): PackageManifest {
  return JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as PackageManifest;
}

describe("migration script configuration", () => {
  it("runs the project migration entrypoint instead of the drizzle-kit renderer", () => {
    const packageManifest = readPackageManifest();

    expect(packageManifest.scripts?.["db:migrate"]).toBe(
      "tsx scripts/migrate.ts",
    );
    expect(packageManifest.devDependencies?.tsx).toBeDefined();
  });
});

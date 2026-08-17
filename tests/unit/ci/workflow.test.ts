import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it("runs the production build in pull request checks", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toMatch(/^\s*-\s+run:\s+npm run build\s*$/m);
  });

  it("checks required Supabase test secrets without printing values", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow.match(/name:\s+Check Supabase test secrets/g)).toHaveLength(2);
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(workflow).toContain(`Missing required Supabase test environment variable: \${name}`);
      expect(workflow).toContain(`${name}: \${{ secrets.${name} }}`);
    }
    expect(workflow).not.toContain("Missing required Supabase test environment variable: ${!");
  });
});

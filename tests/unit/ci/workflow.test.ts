import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it("blocks unaccepted high and critical dependency advisories", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toMatch(
      /^\s*-\s+run:\s+npm run audit:dependencies\s*$/m,
    );
  });

  it("runs the production build in pull request checks", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow.match(/^\s*run:\s+npm run build\s*$/gm)).toHaveLength(2);
  });

  it("keeps Dependabot checks isolated from hosted Supabase secrets", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/ci.yml"),
      "utf8",
    );

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).toContain("Run offline unit tests for Dependabot");
    expect(workflow).toContain("run: npm run test:unit:offline");
    expect(workflow).toContain("Build with synthetic configuration for Dependabot");
    expect(workflow).toContain(
      "github.event.pull_request.user.login == 'dependabot[bot]'",
    );
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

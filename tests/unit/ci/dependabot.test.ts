import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Dependabot configuration", () => {
  const configuration = readFileSync(
    join(process.cwd(), ".github/dependabot.yml"),
    "utf8",
  );

  it("monitors npm and GitHub Actions from the repository root", () => {
    expect(configuration).toMatch(/^version:\s*2$/m);
    expect(configuration.match(/package-ecosystem:/g)).toHaveLength(2);
    expect(configuration).toContain('package-ecosystem: "npm"');
    expect(configuration).toContain('package-ecosystem: "github-actions"');
    expect(configuration.match(/^\s+directory:\s+"\/"$/gm)).toHaveLength(2);
  });

  it("uses explicit weekly schedules in the project timezone", () => {
    expect(configuration.match(/^\s+interval:\s+"weekly"$/gm)).toHaveLength(2);
    expect(configuration).toContain('day: "monday"');
    expect(configuration).toContain('day: "tuesday"');
    expect(
      configuration.match(/^\s+timezone:\s+"America\/Sao_Paulo"$/gm),
    ).toHaveLength(2);
  });

  it("groups only minor and patch version updates", () => {
    expect(configuration.match(/applies-to:\s+"version-updates"/g)).toHaveLength(3);
    expect(configuration).not.toContain('applies-to: "security-updates"');
    expect(configuration.match(/^\s+-\s+"minor"$/gm)).toHaveLength(3);
    expect(configuration.match(/^\s+-\s+"patch"$/gm)).toHaveLength(3);
    expect(configuration).not.toMatch(/^\s+-\s+"major"$/m);
  });

  it("bounds version-update PR volume without disabling security updates", () => {
    expect(configuration).toContain("open-pull-requests-limit: 5");
    expect(configuration).toContain("open-pull-requests-limit: 3");
    expect(configuration).not.toContain("open-pull-requests-limit: 0");
  });
});

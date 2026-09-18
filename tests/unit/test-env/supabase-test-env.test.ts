import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasDirectDatabaseTestEnv,
  hasSupabaseTestEnv as hasComplianceSupabaseTestEnv,
} from "../../compliance/support";
import { hasSupabaseTestEnv as hasE2eSupabaseTestEnv } from "../../e2e/support";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const helpers = [
  ["compliance", hasComplianceSupabaseTestEnv],
  ["e2e", hasE2eSupabaseTestEnv],
] as const;

function clearSupabaseTestEnv() {
  for (const name of REQUIRED_ENV) {
    vi.stubEnv(name, undefined);
  }
}

describe("Supabase test environment guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(helpers)("returns true for %s when all required env vars exist", (_name, hasEnv) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    expect(hasEnv()).toBe(true);
  });

  it.each(helpers)(
    "returns false for %s outside CI when any required env var is missing",
    (_name, hasEnv) => {
      clearSupabaseTestEnv();
      vi.stubEnv("CI", undefined);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

      expect(hasEnv()).toBe(false);
    },
  );

  it.each(helpers)("throws for %s in CI when each required env var is missing", (_name, hasEnv) => {
    for (const missingName of REQUIRED_ENV) {
      vi.unstubAllEnvs();
      vi.stubEnv("CI", "true");

      for (const name of REQUIRED_ENV) {
        if (name !== missingName) {
          vi.stubEnv(name, `${name}-set`);
        }
      }
      vi.stubEnv(missingName, undefined);

      expect(() => hasEnv()).toThrow(missingName);
    }
  });

  it("accepts a direct compliance connection for the API project", () => {
    const projectRef = "abcdefghijklmnopqrst";
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      `https://${projectRef}.supabase.co`,
    );
    vi.stubEnv(
      "DIRECT_URL",
      `postgresql://postgres.${projectRef}:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
    );

    expect(hasDirectDatabaseTestEnv()).toBe(true);
  });

  it("rejects a direct compliance connection for another project", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://abcdefghijklmnopqrst.supabase.co",
    );
    vi.stubEnv(
      "DIRECT_URL",
      "postgresql://postgres.zyxwvutsrqponmlkjihg:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres",
    );

    expect(() => hasDirectDatabaseTestEnv()).toThrow(
      "Supabase project mismatch",
    );
  });
});

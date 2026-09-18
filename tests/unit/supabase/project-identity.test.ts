import { describe, expect, it } from "vitest";
import {
  assertSupabaseProjectConsistency,
  getSupabaseApiIdentity,
  getSupabaseDatabaseIdentity,
} from "@/lib/supabase/project-identity";

const PROJECT_REF = "abcdefghijklmnopqrst";
const OTHER_PROJECT_REF = "zyxwvutsrqponmlkjihg";

describe("Supabase project identity", () => {
  it("extracts the project ref from the hosted API URL", () => {
    expect(
      getSupabaseApiIdentity(`https://${PROJECT_REF}.supabase.co`),
    ).toEqual({ kind: "hosted", projectRef: PROJECT_REF });
  });

  it("extracts the project ref from direct and dedicated-pooler hosts", () => {
    for (const port of [5432, 6543]) {
      expect(
        getSupabaseDatabaseIdentity(
          `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co:${port}/postgres`,
          "DIRECT_URL",
        ),
      ).toEqual({ kind: "hosted", projectRef: PROJECT_REF });
    }
  });

  it("extracts the project ref from shared-pooler usernames", () => {
    for (const role of ["postgres", "migration.role"]) {
      expect(
        getSupabaseDatabaseIdentity(
          `postgresql://${role}.${PROJECT_REF}:secret@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
          "DIRECT_URL",
        ),
      ).toEqual({ kind: "hosted", projectRef: PROJECT_REF });
    }
  });

  it("accepts matching direct and optional connectivity URLs", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
        directUrl: `postgresql://postgres.${PROJECT_REF}:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
        databaseUrl: `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co:5432/postgres`,
      }),
    ).not.toThrow();
  });

  it("allows absent optional database URLs", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
      }),
    ).not.toThrow();
  });

  it("accepts local API and database endpoints as one local project", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: "http://127.0.0.1:54321",
        directUrl: "postgresql://postgres:postgres@localhost:54322/postgres",
      }),
    ).not.toThrow();
  });

  it("rejects different hosted projects", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
        directUrl: `postgresql://postgres.${OTHER_PROJECT_REF}:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
      }),
    ).toThrow(
      `NEXT_PUBLIC_SUPABASE_URL targets project ${PROJECT_REF}, but DIRECT_URL targets project ${OTHER_PROJECT_REF}`,
    );
  });

  it("rejects mixing local and hosted projects", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: "http://localhost:54321",
        databaseUrl: `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co:5432/postgres`,
      }),
    ).toThrow("Supabase project mismatch");
  });

  it("fails closed when a database URL cannot identify a Supabase project", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
        directUrl:
          "postgresql://postgres:super-secret@database.example.com/postgres",
      }),
    ).toThrow("Cannot determine the Supabase project from DIRECT_URL");
  });

  it("does not expose credentials in validation errors", () => {
    const secret = "super-secret-password";

    expect(() =>
      assertSupabaseProjectConsistency({
        supabaseUrl: `https://${PROJECT_REF}.supabase.co`,
        directUrl: `postgresql://postgres:${secret}@database.example.com/postgres`,
      }),
    ).toThrowError(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });

  it("requires the public project URL before validating a database URL", () => {
    expect(() =>
      assertSupabaseProjectConsistency({
        directUrl: `postgresql://postgres:secret@db.${PROJECT_REF}.supabase.co:5432/postgres`,
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL is required");
  });
});

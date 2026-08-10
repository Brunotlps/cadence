import { describe, expect, it, vi } from "vitest";
import { resolveProfileAccentColor } from "@/lib/profiles/resolve-accent-color";

describe("fallback server-side da cor de destaque", () => {
  it("usa a preferência persistida sem registrar fallback", () => {
    const logger = vi.fn();

    const result = resolveProfileAccentColor(
      { data: "rosa", error: null },
      logger,
    );

    expect(result).toBe("rosa");
    expect(logger).not.toHaveBeenCalled();
  });

  it("usa verde e registra profile_missing sem dado pessoal", () => {
    const logger = vi.fn();

    const result = resolveProfileAccentColor(
      { data: null, error: null },
      logger,
    );

    expect(result).toBe("verde");
    expect(logger).toHaveBeenCalledWith("profile_accent_fallback", {
      reason: "profile_missing",
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("userId");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("email");
  });

  it("usa verde e registra query_failed sem erro bruto", () => {
    const logger = vi.fn();

    const result = resolveProfileAccentColor(
      { data: null, error: "query_failed" },
      logger,
    );

    expect(result).toBe("verde");
    expect(logger).toHaveBeenCalledWith("profile_accent_fallback", {
      reason: "query_failed",
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("Supabase");
  });
});

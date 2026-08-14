import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/navigation/safe-next-path";

describe("safeNextPath", () => {
  it("aceita um caminho relativo", () => {
    expect(safeNextPath("/join/abc", "/dashboard")).toBe("/join/abc");
  });

  it("usa o fallback quando next é nulo", () => {
    expect(safeNextPath(null, "/dashboard")).toBe("/dashboard");
  });

  it("usa o fallback quando next não começa com /", () => {
    expect(safeNextPath("dashboard", "/dashboard")).toBe("/dashboard");
  });

  it("usa o fallback quando next é um open redirect via // (protocol-relative)", () => {
    expect(safeNextPath("//evil.com", "/dashboard")).toBe("/dashboard");
  });

  it("usa o fallback quando next é uma URL absoluta", () => {
    expect(safeNextPath("https://evil.com", "/dashboard")).toBe("/dashboard");
  });
});

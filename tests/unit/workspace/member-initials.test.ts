import { describe, expect, it } from "vitest";
import { getMemberInitials } from "@/lib/workspace/member-initials";

describe("getMemberInitials", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(getMemberInitials("Ana Teixeira")).toBe("AT");
  });

  it("usa nomes do meio só para achar o último, ignorando-os no resultado", () => {
    expect(getMemberInitials("Ana Paula Teixeira")).toBe("AT");
  });

  it("usa só uma letra quando há uma única palavra", () => {
    expect(getMemberInitials("Ana")).toBe("A");
  });

  it("ignora espaços extras entre e ao redor das palavras", () => {
    expect(getMemberInitials("  Ana   Teixeira  ")).toBe("AT");
  });

  it("usa maiúsculas mesmo com nome em minúsculas", () => {
    expect(getMemberInitials("ana teixeira")).toBe("AT");
  });

  it("cai no fallback quando display_name é nulo", () => {
    expect(getMemberInitials(null)).toBe("?");
  });

  it("cai no fallback quando display_name é string vazia ou só espaços", () => {
    expect(getMemberInitials("")).toBe("?");
    expect(getMemberInitials("   ")).toBe("?");
  });
});

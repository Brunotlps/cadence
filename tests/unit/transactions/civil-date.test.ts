import { describe, expect, it } from "vitest";
import {
  getMonthRange,
  getTodayInSaoPaulo,
  isValidCivilDate,
  isValidMonth,
  resolveMonth,
  shiftMonth,
} from "@/lib/transactions/civil-date";

describe("data civil", () => {
  it.each(["2026-08-06", "2024-02-29", "2000-01-01"])(
    "aceita a data real %s",
    (value) => {
      expect(isValidCivilDate(value)).toBe(true);
    },
  );

  it.each([
    "2026-02-29",
    "2026-13-01",
    "2026-04-31",
    "06/08/2026",
    "2026-8-6",
    "",
  ])("rejeita a data inválida %s", (value) => {
    expect(isValidCivilDate(value)).toBe(false);
  });

  it("calcula hoje em America/Sao_Paulo na virada do dia UTC", () => {
    expect(getTodayInSaoPaulo(new Date("2026-08-06T02:30:00.000Z"))).toBe(
      "2026-08-05",
    );
    expect(getTodayInSaoPaulo(new Date("2026-08-06T03:30:00.000Z"))).toBe(
      "2026-08-06",
    );
  });
});

describe("período mensal", () => {
  it.each(["2026-01", "2026-12", "2000-02"])(
    "aceita o mês canônico %s",
    (value) => {
      expect(isValidMonth(value)).toBe(true);
    },
  );

  it.each(["2026-00", "2026-13", "26-08", "2026-8", ""])(
    "rejeita o mês inválido %s",
    (value) => {
      expect(isValidMonth(value)).toBe(false);
    },
  );

  it("retorna limite inicial inclusivo e próximo mês exclusivo", () => {
    expect(getMonthRange("2026-08")).toEqual({
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });
  });

  it("avança corretamente do dezembro para janeiro", () => {
    expect(getMonthRange("2026-12")).toEqual({
      start: "2026-12-01",
      endExclusive: "2027-01-01",
    });
  });

  it("rejeita período inválido antes de construir limites de consulta", () => {
    expect(() => getMonthRange("2026-13")).toThrow(RangeError);
  });

  it.each([
    ["2026-01", -1, "2025-12"],
    ["2026-12", 1, "2027-01"],
    ["2026-08", -6, "2026-02"],
  ])("desloca %s por %i mês(es) para %s", (month, offset, expected) => {
    expect(shiftMonth(month, offset)).toBe(expected);
  });

  it("mantém query válida e cai no mês atual de São Paulo para entrada inválida", () => {
    const now = new Date("2026-08-06T02:30:00.000Z");

    expect(resolveMonth("2026-02", now)).toBe("2026-02");
    expect(resolveMonth("https://example.com", now)).toBe("2026-08");
    expect(resolveMonth(["2026-02"], now)).toBe("2026-08");
    expect(resolveMonth(undefined, now)).toBe("2026-08");
  });
});

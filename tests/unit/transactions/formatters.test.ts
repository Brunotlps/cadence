import { describe, expect, it } from "vitest";
import {
  formatCivilDatePtBR,
  formatCurrencyBRL,
  formatMonthPtBR,
} from "@/lib/formatters";

function normalizeSpaces(value: string) {
  return value.replace(/\u00a0/g, " ");
}

describe("formatCurrencyBRL", () => {
  it.each([
    [0, "R$ 0,00"],
    [1, "R$ 0,01"],
    [123456, "R$ 1.234,56"],
    [-12345, "-R$ 123,45"],
  ])("formata %i centavos como %s", (cents, expected) => {
    expect(normalizeSpaces(formatCurrencyBRL(cents))).toBe(expected);
  });

  it("rejeita valor que não representa centavos inteiros", () => {
    expect(() => formatCurrencyBRL(1.5)).toThrow(TypeError);
  });
});

describe("formatCivilDatePtBR", () => {
  it("formata date do Postgres sem deslocamento de fuso", () => {
    expect(formatCivilDatePtBR("2026-08-05")).toBe("05/08/2026");
  });

  it("rejeita uma data civil inválida", () => {
    expect(() => formatCivilDatePtBR("2026-02-29")).toThrow(RangeError);
  });
});

describe("formatMonthPtBR", () => {
  it("formata o período mensal em português", () => {
    expect(formatMonthPtBR("2026-08")).toBe("agosto de 2026");
  });

  it("rejeita um período mensal inválido", () => {
    expect(() => formatMonthPtBR("2026-13")).toThrow(RangeError);
  });
});

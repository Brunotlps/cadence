import { describe, expect, it } from "vitest";
import {
  centsToNumeric,
  parseAmountToCents,
} from "@/lib/transactions/money";

describe("parseAmountToCents", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1.234", 123400],
    [" 0,01 ", 1],
    ["12,5", 1250],
    ["-1,00", -100],
    ["0", 0],
  ])("converte %s sem usar ponto flutuante", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it.each([
    "",
    " ",
    "R$ 10,00",
    "1,234.56",
    "12,345",
    "1.23,45",
    "abc",
    "NaN",
    "Infinity",
  ])("rejeita a representação inválida %j", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
});

describe("centsToNumeric", () => {
  it.each([
    [0, "0.00"],
    [1, "0.01"],
    [123456, "1234.56"],
    [-100, "-1.00"],
    [999999999999, "9999999999.99"],
  ])("normaliza %i centavos para %s", (cents, expected) => {
    expect(centsToNumeric(cents)).toBe(expected);
  });
});

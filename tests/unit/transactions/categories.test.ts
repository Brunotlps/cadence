import { describe, expect, it } from "vitest";
import {
  TRANSACTION_CATEGORIES,
  deriveTransactionKind,
} from "@/lib/transactions/categories";

const EXPECTED_CATEGORIES = [
  ["alimentacao", "Alimentação"],
  ["aluguel", "Aluguel"],
  ["assinaturas", "Assinaturas"],
  ["automoveis", "Automóveis"],
  ["combustivel", "Combustível"],
  ["condominio", "Condomínio"],
  ["internet", "Internet"],
  ["lazer", "Lazer"],
  ["luz", "Luz"],
  ["renda", "Renda"],
  ["saude", "Saúde"],
] as const;

describe("categorias de lançamento", () => {
  it("mantém exatamente a lista fixa aprovada, com códigos estáveis", () => {
    expect(
      TRANSACTION_CATEGORIES.map(({ code, label }) => [code, label]),
    ).toEqual(EXPECTED_CATEGORIES);
  });

  it("usa códigos únicos sem acentos como valores persistidos", () => {
    const codes = TRANSACTION_CATEGORIES.map(({ code }) => code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[a-z]+$/.test(code))).toBe(true);
  });
});

describe("deriveTransactionKind", () => {
  it("deriva income exclusivamente da categoria Renda", () => {
    expect(deriveTransactionKind("renda")).toBe("income");
  });

  it.each(
    EXPECTED_CATEGORIES.filter(([code]) => code !== "renda").map(
      ([code]) => code,
    ),
  )("deriva expense da categoria %s", (category) => {
    expect(deriveTransactionKind(category)).toBe("expense");
  });
});

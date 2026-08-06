import { describe, expect, it } from "vitest";
import { summarizeTransactions } from "@/lib/transactions/summarize-transactions";

describe("summarizeTransactions", () => {
  it("retorna resumo zerado para um mês sem lançamentos", () => {
    expect(summarizeTransactions([])).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      contributionCents: 0,
      balanceCents: 0,
      expensesByCategory: [],
    });
  });

  it("calcula receitas menos despesas e aportes", () => {
    const summary = summarizeTransactions([
      { kind: "income", amount: "5000.00", category: "renda" },
      { kind: "expense", amount: "1200.00", category: "aluguel" },
      { kind: "contribution", amount: "800.00", category: null },
    ]);

    expect(summary).toMatchObject({
      incomeCents: 500000,
      expenseCents: 120000,
      contributionCents: 80000,
      balanceCents: 300000,
    });
  });

  it("trata a dedução de aportes como a regra provisória aprovada", () => {
    const withoutContribution = summarizeTransactions([
      { kind: "income", amount: "100.00", category: "renda" },
    ]);
    const withContribution = summarizeTransactions([
      { kind: "income", amount: "100.00", category: "renda" },
      { kind: "contribution", amount: "25.00", category: null },
    ]);

    expect(withoutContribution.balanceCents).toBe(10000);
    expect(withContribution.balanceCents).toBe(7500);
  });

  it("agrega apenas despesas por categoria e ordena do maior total para o menor", () => {
    const summary = summarizeTransactions([
      { kind: "expense", amount: "20.10", category: "alimentacao" },
      { kind: "expense", amount: "0.20", category: "alimentacao" },
      { kind: "expense", amount: "50.00", category: "lazer" },
      { kind: "income", amount: "200.00", category: "renda" },
      { kind: "contribution", amount: "30.00", category: null },
    ]);

    expect(summary.expensesByCategory).toEqual([
      { category: "lazer", totalCents: 5000 },
      { category: "alimentacao", totalCents: 2030 },
    ]);
  });

  it("soma centavos sem erro de ponto flutuante", () => {
    const summary = summarizeTransactions([
      { kind: "expense", amount: "0.10", category: "luz" },
      { kind: "expense", amount: "0.20", category: "luz" },
    ]);

    expect(summary.expenseCents).toBe(30);
    expect(summary.balanceCents).toBe(-30);
    expect(summary.expensesByCategory).toEqual([
      { category: "luz", totalCents: 30 },
    ]);
  });
});

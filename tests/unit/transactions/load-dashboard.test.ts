import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWorkspace: vi.fn(),
  hasAnyTransactions: vi.fn(),
  listMonthlyTransactions: vi.fn(),
}));

vi.mock("@/lib/transactions/repository", () => ({
  hasAnyTransactions: mocks.hasAnyTransactions,
  listMonthlyTransactions: mocks.listMonthlyTransactions,
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

import { loadTransactionDashboard } from "@/lib/transactions/load-dashboard";

const client = {} as SupabaseClient;
const transaction = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  kind: "expense" as const,
  amount: "123.45",
  category: "alimentacao" as const,
  description: "Mercado",
  paymentMethod: "pix" as const,
  occurredOn: "2026-08-06",
  createdAt: "2026-08-06T12:00:00.000Z",
};

describe("loadTransactionDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.listMonthlyTransactions.mockResolvedValue({
      data: [transaction],
      error: null,
    });
    mocks.hasAnyTransactions.mockResolvedValue({ data: true, error: null });
  });

  it("resolve o mês, limita a leitura e agrega o resultado no servidor", async () => {
    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
    );

    expect(mocks.getCurrentWorkspace).toHaveBeenCalledWith(client, "user-id");
    expect(mocks.listMonthlyTransactions).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });
    expect(mocks.hasAnyTransactions).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        month: "2026-08",
        transactions: [transaction],
        isWorkspaceEmpty: false,
        summary: {
          incomeCents: 0,
          expenseCents: 12345,
          contributionCents: 0,
          balanceCents: -12345,
          expensesByCategory: [
            { category: "alimentacao", totalCents: 12345 },
          ],
        },
      },
    });
  });

  it("consulta existência global somente quando o mês está vazio", async () => {
    mocks.listMonthlyTransactions.mockResolvedValue({ data: [], error: null });
    mocks.hasAnyTransactions.mockResolvedValue({ data: true, error: null });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-07",
    );

    expect(mocks.hasAnyTransactions).toHaveBeenCalledWith(client, "workspace-id");
    expect(result).toMatchObject({
      status: "ready",
      data: { isWorkspaceEmpty: false, transactions: [] },
    });
  });

  it("identifica workspace sem nenhum lançamento", async () => {
    mocks.listMonthlyTransactions.mockResolvedValue({ data: [], error: null });
    mocks.hasAnyTransactions.mockResolvedValue({ data: false, error: null });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
    );

    expect(result).toMatchObject({
      status: "ready",
      data: { isWorkspaceEmpty: true, transactions: [] },
    });
  });

  it("separa ausência de workspace de falha de leitura", async () => {
    mocks.getCurrentWorkspace.mockResolvedValueOnce({ data: null, error: null });
    const withoutWorkspace = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
    );

    mocks.getCurrentWorkspace.mockResolvedValueOnce({
      data: null,
      error: "query_failed",
    });
    const failed = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
    );

    expect(withoutWorkspace).toEqual({ status: "no_workspace" });
    expect(failed).toEqual({ status: "error" });
    expect(mocks.listMonthlyTransactions).not.toHaveBeenCalled();
  });

  it("reduz falhas mensais ou de existência ao mesmo estado genérico", async () => {
    mocks.listMonthlyTransactions
      .mockResolvedValueOnce({ data: null, error: "query_failed" })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.hasAnyTransactions.mockResolvedValueOnce({
      data: null,
      error: "query_failed",
    });

    const monthlyFailure = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
    );
    const existenceFailure = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
    );

    expect(monthlyFailure).toEqual({ status: "error" });
    expect(existenceFailure).toEqual({ status: "error" });
  });

  it("substitui query month inválida pelo mês atual de São Paulo", async () => {
    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "//attacker.example",
      new Date("2026-08-06T02:30:00.000Z"),
    );

    expect(mocks.listMonthlyTransactions).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });
    expect(result).toMatchObject({
      status: "ready",
      data: { month: "2026-08" },
    });
  });
});

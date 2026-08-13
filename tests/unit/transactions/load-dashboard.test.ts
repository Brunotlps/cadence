import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWorkspace: vi.fn(),
  hasAnyTransactions: vi.fn(),
  listMonthlyTransactions: vi.fn(),
  listFixedBills: vi.fn(),
  listBillPayments: vi.fn(),
}));

vi.mock("@/lib/transactions/repository", () => ({
  hasAnyTransactions: mocks.hasAnyTransactions,
  listMonthlyTransactions: mocks.listMonthlyTransactions,
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/fixed-bills/repository", () => ({
  listFixedBills: mocks.listFixedBills,
  listBillPayments: mocks.listBillPayments,
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
    mocks.listFixedBills.mockResolvedValue({ data: [], error: null });
    mocks.listBillPayments.mockResolvedValue({ data: [], error: null });
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
        pendingFixedBills: [],
        paidFixedBills: [],
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

describe("loadTransactionDashboard — contas fixas pendentes", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  function bill(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "bill-id",
      name: "Conta",
      dueDay: 1,
      category: "luz",
      autopay: false,
      variableAmount: false,
      estimatedAmount: "100.00",
      startedOn: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      linkedPaymentCount: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.listMonthlyTransactions.mockResolvedValue({ data: [], error: null });
    mocks.hasAnyTransactions.mockResolvedValue({ data: true, error: null });
  });

  it("inclui contas pendentes, a vencer e em atraso, ordenadas por vencimento", async () => {
    mocks.listFixedBills.mockResolvedValue({
      data: [
        bill({ id: "pending", name: "Internet", dueDay: 25 }),
        bill({ id: "due-soon", name: "Água", dueDay: 10, variableAmount: true }),
        bill({ id: "overdue", name: "Aluguel", dueDay: 1 }),
      ],
      error: null,
    });
    mocks.listBillPayments.mockResolvedValue({ data: [], error: null });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
      now,
    );

    expect(result).toMatchObject({
      status: "ready",
      data: {
        pendingFixedBills: [
          { id: "overdue", name: "Aluguel", status: "overdue" },
          { id: "due-soon", name: "Água", status: "due_soon" },
          { id: "pending", name: "Internet", status: "pending" },
        ],
      },
    });
    if (result.status === "ready") {
      for (const item of result.data.pendingFixedBills) {
        expect(item).not.toHaveProperty("estimatedCents");
        expect(item).not.toHaveProperty("category");
        expect(item).not.toHaveProperty("variableAmount");
      }
    }
  });

  it("exclui contas já pagas no mês da lista de pendentes e inclui na de pagas", async () => {
    mocks.listFixedBills.mockResolvedValue({
      data: [bill({ id: "paid", name: "Luz", dueDay: 10 })],
      error: null,
    });
    mocks.listBillPayments.mockResolvedValue({
      data: [
        {
          id: "payment-id",
          fixedBillId: "paid",
          createdBy: "user-id",
          amount: "100.00",
          paymentMethod: null,
          occurredOn: "2026-08-05",
          createdAt: "2026-08-05T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
      now,
    );

    expect(result).toMatchObject({
      status: "ready",
      data: {
        pendingFixedBills: [],
        paidFixedBills: [{ id: "paid", name: "Luz", paidOn: "2026-08-05" }],
      },
    });
  });

  it("usa o pagamento mais recente quando a conta foi paga mais de uma vez no mês", async () => {
    mocks.listFixedBills.mockResolvedValue({
      data: [bill({ id: "paid-twice", name: "Internet", dueDay: 10 })],
      error: null,
    });
    mocks.listBillPayments.mockResolvedValue({
      data: [
        {
          id: "payment-2",
          fixedBillId: "paid-twice",
          createdBy: "user-id",
          amount: "50.00",
          paymentMethod: null,
          occurredOn: "2026-08-20",
          createdAt: "2026-08-20T00:00:00.000Z",
        },
        {
          id: "payment-1",
          fixedBillId: "paid-twice",
          createdBy: "user-id",
          amount: "50.00",
          paymentMethod: null,
          occurredOn: "2026-08-05",
          createdAt: "2026-08-05T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
      now,
    );

    expect(result).toMatchObject({
      status: "ready",
      data: {
        paidFixedBills: [
          { id: "paid-twice", name: "Internet", paidOn: "2026-08-20" },
        ],
      },
    });
  });

  it("ordena contas pagas por data de pagamento", async () => {
    mocks.listFixedBills.mockResolvedValue({
      data: [
        bill({ id: "paid-later", name: "Internet", dueDay: 20 }),
        bill({ id: "paid-earlier", name: "Água", dueDay: 5 }),
      ],
      error: null,
    });
    mocks.listBillPayments.mockResolvedValue({
      data: [
        {
          id: "payment-later",
          fixedBillId: "paid-later",
          createdBy: "user-id",
          amount: "50.00",
          paymentMethod: null,
          occurredOn: "2026-08-20",
          createdAt: "2026-08-20T00:00:00.000Z",
        },
        {
          id: "payment-earlier",
          fixedBillId: "paid-earlier",
          createdBy: "user-id",
          amount: "50.00",
          paymentMethod: null,
          occurredOn: "2026-08-05",
          createdAt: "2026-08-05T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
      now,
    );

    expect(result).toMatchObject({
      status: "ready",
      data: {
        paidFixedBills: [
          { id: "paid-earlier", name: "Água", paidOn: "2026-08-05" },
          { id: "paid-later", name: "Internet", paidOn: "2026-08-20" },
        ],
      },
    });
  });

  it("exclui contas sem pagamento ao visualizar um mês que não é o atual", async () => {
    mocks.listFixedBills.mockResolvedValue({
      data: [bill({ id: "other-month", name: "Internet", dueDay: 10 })],
      error: null,
    });
    mocks.listBillPayments.mockResolvedValue({ data: [], error: null });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-07",
      now,
    );

    expect(result).toMatchObject({
      status: "ready",
      data: { pendingFixedBills: [] },
    });
  });

  it("reduz falha ao ler contas fixas ou pagamentos ao mesmo estado genérico", async () => {
    mocks.listFixedBills.mockResolvedValue({ data: null, error: "query_failed" });

    const result = await loadTransactionDashboard(
      client,
      "user-id",
      "2026-08",
      now,
    );

    expect(result).toEqual({ status: "error" });
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWorkspace: vi.fn(),
  listBillPayments: vi.fn(),
  listFixedBills: vi.fn(),
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/fixed-bills/repository", () => ({
  listBillPayments: mocks.listBillPayments,
  listFixedBills: mocks.listFixedBills,
}));

import { loadFixedBillsDashboard } from "@/lib/fixed-bills/load-dashboard";

const client = {} as SupabaseClient;
const lightBill = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Luz",
  dueDay: 5,
  category: "luz" as const,
  autopay: false,
  variableAmount: true,
  estimatedAmount: "180.00",
  startedOn: "2026-05-01",
  createdAt: "2026-05-01T12:00:00.000Z",
  linkedPaymentCount: 3,
};
const rentBill = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Aluguel",
  dueDay: 10,
  category: "aluguel" as const,
  autopay: true,
  variableAmount: false,
  estimatedAmount: "2500.00",
  startedOn: "2026-06-01",
  createdAt: "2026-06-01T12:00:00.000Z",
  linkedPaymentCount: 2,
};
const internetBill = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Internet",
  dueDay: 20,
  category: "internet" as const,
  autopay: false,
  variableAmount: false,
  estimatedAmount: "120.00",
  startedOn: "2026-07-01",
  createdAt: "2026-07-01T12:00:00.000Z",
  linkedPaymentCount: 0,
};
const payment = {
  id: "44444444-4444-4444-8444-444444444444",
  fixedBillId: lightBill.id,
  createdBy: "user-id",
  amount: "194.32",
  paymentMethod: "pix" as const,
  occurredOn: "2026-08-03",
  createdAt: "2026-08-03T13:00:00.000Z",
};

describe("loadFixedBillsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.listFixedBills.mockResolvedValue({
      data: [lightBill, rentBill, internetBill],
      error: null,
    });
    mocks.listBillPayments.mockResolvedValue({
      data: [payment],
      error: null,
    });
  });

  it("carrega as duas fontes do mês e deriva os cards no servidor", async () => {
    const result = await loadFixedBillsDashboard(
      client,
      "user-id",
      "2026-08",
      "todas",
      new Date("2026-08-08T15:00:00.000Z"),
    );

    expect(mocks.getCurrentWorkspace).toHaveBeenCalledWith(client, "user-id");
    expect(mocks.listFixedBills).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      throughDate: "2026-08-31",
    });
    expect(mocks.listBillPayments).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });
    expect(result).toMatchObject({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        month: "2026-08",
        today: "2026-08-08",
        filter: "todas",
        totalBillCount: 3,
        bills: [
          {
            ...lightBill,
            dueOn: "2026-08-05",
            status: "paid",
            estimatedCents: 18_000,
            paidCents: 19_432,
            paymentCount: 1,
            payments: [payment],
          },
          {
            ...rentBill,
            dueOn: "2026-08-10",
            status: "due_soon",
            paidCents: 0,
          },
          {
            ...internetBill,
            dueOn: "2026-08-20",
            status: "pending",
            paidCents: 0,
          },
        ],
      },
    });
  });

  it.each([
    ["pagas", ["Luz"]],
    ["pendentes", ["Aluguel", "Internet"]],
    ["automaticas", ["Aluguel"]],
  ] as const)("aplica o filtro %s em memória", async (filter, names) => {
    const result = await loadFixedBillsDashboard(
      client,
      "user-id",
      "2026-08",
      filter,
      new Date("2026-08-08T15:00:00.000Z"),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected ready result");
    expect(result.data.bills.map((bill) => bill.name)).toEqual(names);
    expect(result.data.totalBillCount).toBe(3);
  });

  it("valida mês e filtro estritamente e usa os padrões para valores desconhecidos", async () => {
    const result = await loadFixedBillsDashboard(
      client,
      "user-id",
      ["2026-07", "2026-08"],
      ["pagas"],
      new Date("2026-08-08T15:00:00.000Z"),
    );

    expect(result).toMatchObject({
      status: "ready",
      data: { month: "2026-08", filter: "todas", totalBillCount: 3 },
    });
  });

  it("separa ausência de workspace de falha de leitura", async () => {
    mocks.getCurrentWorkspace.mockResolvedValueOnce({ data: null, error: null });
    const withoutWorkspace = await loadFixedBillsDashboard(
      client,
      "user-id",
      undefined,
      undefined,
    );

    mocks.getCurrentWorkspace.mockResolvedValueOnce({
      data: null,
      error: "query_failed",
    });
    const failed = await loadFixedBillsDashboard(
      client,
      "user-id",
      undefined,
      undefined,
    );

    expect(withoutWorkspace).toEqual({ status: "no_workspace" });
    expect(failed).toEqual({ status: "error" });
    expect(mocks.listFixedBills).not.toHaveBeenCalled();
  });

  it("reduz falha de qualquer consulta ao mesmo estado genérico", async () => {
    mocks.listFixedBills
      .mockResolvedValueOnce({ data: null, error: "query_failed" })
      .mockResolvedValueOnce({ data: [lightBill], error: null });
    mocks.listBillPayments
      .mockResolvedValueOnce({ data: [payment], error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const billFailure = await loadFixedBillsDashboard(
      client,
      "user-id",
      "2026-08",
      "todas",
    );
    const paymentFailure = await loadFixedBillsDashboard(
      client,
      "user-id",
      "2026-08",
      "todas",
    );

    expect(billFailure).toEqual({ status: "error" });
    expect(paymentFailure).toEqual(billFailure);
  });

  it("reduz dado monetário inválido a estado genérico", async () => {
    mocks.listFixedBills.mockResolvedValue({
      data: [{ ...lightBill, estimatedAmount: "invalid" }],
      error: null,
    });

    await expect(
      loadFixedBillsDashboard(
        client,
        "user-id",
        "2026-08",
        "todas",
        new Date("2026-08-08T15:00:00.000Z"),
      ),
    ).resolves.toEqual({ status: "error" });
  });
});

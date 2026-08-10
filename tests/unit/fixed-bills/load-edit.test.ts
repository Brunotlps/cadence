import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBillPaymentById: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getFixedBillById: vi.fn(),
  listFixedBills: vi.fn(),
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/fixed-bills/repository", () => ({
  getBillPaymentById: mocks.getBillPaymentById,
  getFixedBillById: mocks.getFixedBillById,
  listFixedBills: mocks.listFixedBills,
}));

import {
  loadBillPaymentForEdit,
  loadFixedBillForEdit,
} from "@/lib/fixed-bills/load-edit";

const client = {} as SupabaseClient;
const fixedBill = {
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
const payment = {
  id: "22222222-2222-4222-8222-222222222222",
  fixedBillId: fixedBill.id,
  createdBy: "user-id",
  amount: "194.32",
  paymentMethod: "pix" as const,
  occurredOn: "2026-08-03",
  createdAt: "2026-08-03T13:00:00.000Z",
};

describe("loaders de edição de contas fixas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.getFixedBillById.mockResolvedValue({
      data: fixedBill,
      error: null,
    });
    mocks.getBillPaymentById.mockResolvedValue({
      data: payment,
      error: null,
    });
    mocks.listFixedBills.mockResolvedValue({
      data: [fixedBill],
      error: null,
    });
  });

  it("carrega conta por id dentro do workspace visível", async () => {
    const result = await loadFixedBillForEdit(
      client,
      "user-id",
      fixedBill.id,
    );

    expect(mocks.getFixedBillById).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      fixedBillId: fixedBill.id,
    });
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        fixedBill,
      },
    });
  });

  it("mantém ausência de workspace como estado separado", async () => {
    mocks.getCurrentWorkspace.mockResolvedValue({ data: null, error: null });

    await expect(
      loadFixedBillForEdit(client, "user-id", fixedBill.id),
    ).resolves.toEqual({ status: "no_workspace" });
    expect(mocks.getFixedBillById).not.toHaveBeenCalled();
  });

  it("torna conta ausente, invisível e falha indistinguíveis", async () => {
    mocks.getFixedBillById
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await loadFixedBillForEdit(
      client,
      "user-id",
      "missing-id",
    );
    const invisible = await loadFixedBillForEdit(
      client,
      "user-id",
      "invisible-id",
    );

    expect(missing).toEqual({ status: "error" });
    expect(invisible).toEqual(missing);
  });

  it("carrega pagamento e contas disponíveis para reatribuição", async () => {
    const result = await loadBillPaymentForEdit(
      client,
      "user-id",
      payment.id,
      new Date("2026-08-08T15:00:00.000Z"),
    );

    expect(mocks.getBillPaymentById).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      transactionId: payment.id,
    });
    expect(mocks.listFixedBills).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      throughDate: "2026-08-08",
    });
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        payment,
        fixedBills: [fixedBill],
      },
    });
  });

  it("torna pagamento ausente, invisível ou falha de contas indistinguíveis", async () => {
    mocks.getBillPaymentById
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" })
      .mockResolvedValueOnce({ data: payment, error: null });
    mocks.listFixedBills.mockResolvedValueOnce({
      data: null,
      error: "query_failed",
    });

    const missing = await loadBillPaymentForEdit(
      client,
      "user-id",
      "missing-id",
    );
    const invisible = await loadBillPaymentForEdit(
      client,
      "user-id",
      "invisible-id",
    );
    const billFailure = await loadBillPaymentForEdit(
      client,
      "user-id",
      payment.id,
    );

    expect(missing).toEqual({ status: "error" });
    expect(invisible).toEqual(missing);
    expect(billFailure).toEqual(missing);
  });
});

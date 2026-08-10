import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWorkspace: vi.fn(),
  getTransactionById: vi.fn(),
}));

vi.mock("@/lib/transactions/repository", () => ({
  getTransactionById: mocks.getTransactionById,
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

import { loadTransactionForEdit } from "@/lib/transactions/load-edit";

const client = {} as SupabaseClient;
const transaction = {
  id: "transaction-id",
  kind: "expense" as const,
  amount: "123.45",
  category: "alimentacao" as const,
  description: "Mercado",
  paymentMethod: "pix" as const,
  fixedBillId: null,
  occurredOn: "2026-08-06",
  createdAt: "2026-08-06T12:00:00.000Z",
};

describe("loadTransactionForEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.getTransactionById.mockResolvedValue({
      data: transaction,
      error: null,
    });
  });

  it("busca o id dentro do workspace visível", async () => {
    const result = await loadTransactionForEdit(
      client,
      "user-id",
      "transaction-id",
    );

    expect(mocks.getCurrentWorkspace).toHaveBeenCalledWith(client, "user-id");
    expect(mocks.getTransactionById).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      transactionId: "transaction-id",
    });
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        transaction,
      },
    });
  });

  it("mantém ausência de workspace como estado separado", async () => {
    mocks.getCurrentWorkspace.mockResolvedValue({ data: null, error: null });

    await expect(
      loadTransactionForEdit(client, "user-id", "transaction-id"),
    ).resolves.toEqual({ status: "no_workspace" });
    expect(mocks.getTransactionById).not.toHaveBeenCalled();
  });

  it("torna registro ausente, invisível e falha de query indistinguíveis", async () => {
    mocks.getTransactionById
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await loadTransactionForEdit(
      client,
      "user-id",
      "missing-id",
    );
    const invisible = await loadTransactionForEdit(
      client,
      "user-id",
      "invisible-id",
    );

    expect(missing).toEqual({ status: "error" });
    expect(invisible).toEqual(missing);
  });

  it("não reclassifica aporte pela tela sem campo de tipo", async () => {
    mocks.getTransactionById.mockResolvedValue({
      data: { ...transaction, kind: "contribution", category: null },
      error: null,
    });

    await expect(
      loadTransactionForEdit(client, "user-id", "contribution-id"),
    ).resolves.toEqual({ status: "error" });
  });

  it("não edita pagamento de conta fixa pela tela genérica", async () => {
    mocks.getTransactionById.mockResolvedValue({
      data: {
        ...transaction,
        fixedBillId: "11111111-1111-4111-8111-111111111111",
      },
      error: null,
    });

    await expect(
      loadTransactionForEdit(client, "user-id", "bill-payment-id"),
    ).resolves.toEqual({ status: "error" });
  });
});

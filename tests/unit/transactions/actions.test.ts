import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteTransaction: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getUser: vi.fn(),
  insertTransaction: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePath: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/transactions/repository", () => ({
  deleteTransaction: mocks.deleteTransaction,
  getCurrentWorkspace: mocks.getCurrentWorkspace,
  insertTransaction: mocks.insertTransaction,
  updateTransaction: mocks.updateTransaction,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
} from "@/lib/actions/transactions";

const initialState: TransactionActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

function transactionForm(overrides: Record<string, string> = {}) {
  const values = {
    amount: "123,45",
    category: "alimentacao",
    occurredOn: "2026-08-06",
    description: "Mercado",
    paymentMethod: "pix",
    month: "2026-08",
    ...overrides,
  };
  const formData = new FormData();

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }

  return formData;
}

describe("Server Actions de lançamentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = {
      auth: { getUser: mocks.getUser },
    } as unknown as SupabaseClient;

    mocks.createClient.mockResolvedValue(client);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "server-user-id" } },
      error: null,
    });
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "server-workspace-id", name: "Casa" },
      error: null,
    });
    mocks.insertTransaction.mockResolvedValue({
      data: { id: "transaction-id" },
      error: null,
    });
    mocks.updateTransaction.mockResolvedValue({
      data: { id: "transaction-id" },
      error: null,
    });
    mocks.deleteTransaction.mockResolvedValue({ data: true, error: null });
  });

  it("cria com autoria e workspace resolvidos no servidor", async () => {
    const result = await createTransactionAction(
      initialState,
      transactionForm(),
    );

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.getCurrentWorkspace).toHaveBeenCalledWith(
      expect.anything(),
      "server-user-id",
    );
    expect(mocks.insertTransaction).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      createdBy: "server-user-id",
      transaction: {
        amount: "123.45",
        amountCents: 12345,
        category: "alimentacao",
        kind: "expense",
        occurredOn: "2026-08-06",
        description: "Mercado",
        paymentMethod: "pix",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result).toEqual({ error: null, fieldErrors: {}, success: true });
  });

  it("retorna erros de campo sem chamar o repositório", async () => {
    const result = await createTransactionAction(
      initialState,
      transactionForm({ amount: "0", category: "inventada" }),
    );

    expect(result).toEqual({
      error: "Revise os campos destacados.",
      fieldErrors: {
        amount: "Informe um valor válido.",
        category: "Selecione uma categoria válida.",
      },
      success: false,
    });
    expect(mocks.insertTransaction).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("não aceita autoria, workspace ou kind enviados no formulário", async () => {
    const formData = transactionForm();
    formData.set("createdBy", "attacker-id");
    formData.set("workspaceId", "foreign-workspace-id");
    formData.set("kind", "income");

    await createTransactionAction(initialState, formData);

    expect(mocks.insertTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdBy: "server-user-id",
        workspaceId: "server-workspace-id",
        transaction: expect.objectContaining({ kind: "expense" }),
      }),
    );
  });

  it("falha genericamente quando a sessão não é válida", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired JWT with internal details" },
    });

    const result = await createTransactionAction(
      initialState,
      transactionForm(),
    );

    expect(result.error).toBe("Não foi possível salvar o lançamento.");
    expect(JSON.stringify(result)).not.toContain("expired JWT");
    expect(mocks.getCurrentWorkspace).not.toHaveBeenCalled();
    expect(mocks.insertTransaction).not.toHaveBeenCalled();
  });

  it("atualiza pelo id vinculado, revalida e volta ao mês validado", async () => {
    await expect(
      updateTransactionAction(
        "bound-transaction-id",
        initialState,
        transactionForm({ month: "2026-07" }),
      ),
    ).rejects.toThrow("redirect:/dashboard?month=2026-07");

    expect(mocks.updateTransaction).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      transactionId: "bound-transaction-id",
      transaction: expect.objectContaining({
        kind: "expense",
        amount: "123.45",
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("não usa month arbitrário como destino de redirect", async () => {
    await expect(
      updateTransactionAction(
        "bound-transaction-id",
        initialState,
        transactionForm({ month: "//attacker.example/path" }),
      ),
    ).rejects.toThrow(/^redirect:\/dashboard\?month=\d{4}-\d{2}$/);

    expect(mocks.redirect).not.toHaveBeenCalledWith("//attacker.example/path");
  });

  it("torna registro ausente e invisível indistinguíveis no update", async () => {
    mocks.updateTransaction
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await updateTransactionAction(
      "missing-id",
      initialState,
      transactionForm(),
    );
    const invisible = await updateTransactionAction(
      "invisible-id",
      initialState,
      transactionForm(),
    );

    expect(missing).toEqual(invisible);
    expect(missing).toEqual({
      error: "Não foi possível salvar o lançamento.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("faz hard-delete e revalida sem aceitar um workspace do formulário", async () => {
    const formData = new FormData();
    formData.set("workspaceId", "foreign-workspace-id");

    const result = await deleteTransactionAction(
      "bound-transaction-id",
      initialState,
      formData,
    );

    expect(mocks.deleteTransaction).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      transactionId: "bound-transaction-id",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result).toEqual({ error: null, fieldErrors: {}, success: true });
  });

  it("retorna o mesmo erro genérico para delete ausente, invisível ou rejeitado", async () => {
    mocks.deleteTransaction
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await deleteTransactionAction(
      "missing-id",
      initialState,
      new FormData(),
    );
    const invisible = await deleteTransactionAction(
      "invisible-id",
      initialState,
      new FormData(),
    );

    expect(missing).toEqual(invisible);
    expect(missing.error).toBe("Não foi possível excluir o lançamento.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

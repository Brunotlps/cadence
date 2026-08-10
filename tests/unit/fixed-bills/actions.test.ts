import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteBillPayment: vi.fn(),
  deleteFixedBill: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getFixedBillById: vi.fn(),
  getUser: vi.fn(),
  insertBillPayment: vi.fn(),
  insertFixedBill: vi.fn(),
  revalidatePath: vi.fn(),
  updateBillPayment: vi.fn(),
  updateFixedBill: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/fixed-bills/repository", () => ({
  deleteBillPayment: mocks.deleteBillPayment,
  deleteFixedBill: mocks.deleteFixedBill,
  getFixedBillById: mocks.getFixedBillById,
  insertBillPayment: mocks.insertBillPayment,
  insertFixedBill: mocks.insertFixedBill,
  updateBillPayment: mocks.updateBillPayment,
  updateFixedBill: mocks.updateFixedBill,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createBillPaymentAction,
  createFixedBillAction,
  deleteBillPaymentAction,
  deleteFixedBillAction,
  updateBillPaymentAction,
  updateFixedBillAction,
  type FixedBillActionState,
} from "@/lib/actions/fixed-bills";

const FIXED_BILL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BILL_ID = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "33333333-3333-4333-8333-333333333333";

const initialState: FixedBillActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

function fixedBillForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    name: "Conta de luz",
    dueDay: "5",
    category: "luz",
    estimatedAmount: "180,00",
    autopay: "on",
    variableAmount: "on",
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }
  return formData;
}

function paymentForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    amount: "194,32",
    occurredOn: "2020-01-02",
    paymentMethod: "pix",
    fixedBillId: FIXED_BILL_ID,
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }
  return formData;
}

describe("Server Actions de contas fixas", () => {
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
    mocks.getFixedBillById.mockImplementation(
      async (_client: SupabaseClient, input: { fixedBillId: string }) => ({
        data: {
          id: input.fixedBillId,
          category: input.fixedBillId === OTHER_BILL_ID ? "internet" : "luz",
        },
        error: null,
      }),
    );
    mocks.insertFixedBill.mockResolvedValue({
      data: { id: FIXED_BILL_ID },
      error: null,
    });
    mocks.updateFixedBill.mockResolvedValue({
      data: { id: FIXED_BILL_ID },
      error: null,
    });
    mocks.deleteFixedBill.mockResolvedValue({ data: true, error: null });
    mocks.insertBillPayment.mockResolvedValue({
      data: { id: PAYMENT_ID },
      error: null,
    });
    mocks.updateBillPayment.mockResolvedValue({
      data: { id: PAYMENT_ID },
      error: null,
    });
    mocks.deleteBillPayment.mockResolvedValue({ data: true, error: null });
  });

  it("cria conta no workspace resolvido e ignora campos sistêmicos do formulário", async () => {
    const formData = fixedBillForm();
    formData.set("workspaceId", "foreign-workspace-id");
    formData.set("startedOn", "1999-01-01");

    const result = await createFixedBillAction(initialState, formData);

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.insertFixedBill).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      fixedBill: {
        name: "Conta de luz",
        dueDay: 5,
        category: "luz",
        estimatedAmount: "180.00",
        estimatedAmountCents: 18_000,
        autopay: true,
        variableAmount: true,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fixed-bills");
    expect(result).toEqual({ error: null, fieldErrors: {}, success: true });
  });

  it("filtra update e delete da conta por id e workspace", async () => {
    await updateFixedBillAction(
      FIXED_BILL_ID,
      initialState,
      fixedBillForm(),
    );
    await deleteFixedBillAction(
      FIXED_BILL_ID,
      initialState,
      new FormData(),
    );

    expect(mocks.updateFixedBill).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      fixedBillId: FIXED_BILL_ID,
      fixedBill: expect.objectContaining({ estimatedAmount: "180.00" }),
    });
    expect(mocks.deleteFixedBill).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      fixedBillId: FIXED_BILL_ID,
    });
  });

  it("torna conta ausente e invisível indistinguíveis", async () => {
    mocks.updateFixedBill
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await updateFixedBillAction(
      "44444444-4444-4444-8444-444444444444",
      initialState,
      fixedBillForm(),
    );
    const invisible = await updateFixedBillAction(
      "55555555-5555-4555-8555-555555555555",
      initialState,
      fixedBillForm(),
    );

    expect(missing).toEqual(invisible);
    expect(missing.error).toBe("Não foi possível salvar a conta fixa.");
  });

  it("cria pagamento somente após confirmar a conta vinculada no workspace", async () => {
    const formData = paymentForm({ fixedBillId: OTHER_BILL_ID });
    formData.set("kind", "income");
    formData.set("category", "renda");
    formData.set("goalId", "attacker-goal-id");
    formData.set("createdBy", "attacker-id");
    formData.set("workspaceId", "foreign-workspace-id");

    const result = await createBillPaymentAction(
      FIXED_BILL_ID,
      initialState,
      formData,
    );

    expect(mocks.getFixedBillById).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      fixedBillId: FIXED_BILL_ID,
    });
    expect(mocks.insertBillPayment).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      createdBy: "server-user-id",
      category: "luz",
      payment: {
        amount: "194.32",
        amountCents: 19_432,
        occurredOn: "2020-01-02",
        paymentMethod: "pix",
        fixedBillId: FIXED_BILL_ID,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fixed-bills");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result.success).toBe(true);
  });

  it("reatribui pagamento só depois de validar a conta de destino", async () => {
    const result = await updateBillPaymentAction(
      PAYMENT_ID,
      initialState,
      paymentForm({ fixedBillId: OTHER_BILL_ID }),
    );

    expect(mocks.getFixedBillById).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      fixedBillId: OTHER_BILL_ID,
    });
    expect(mocks.updateBillPayment).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      transactionId: PAYMENT_ID,
      category: "internet",
      payment: expect.objectContaining({ fixedBillId: OTHER_BILL_ID }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fixed-bills");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result.success).toBe(true);
  });

  it("bloqueia pagamento para conta ausente ou invisível", async () => {
    mocks.getFixedBillById.mockResolvedValue({ data: null, error: null });

    const result = await updateBillPaymentAction(
      PAYMENT_ID,
      initialState,
      paymentForm({ fixedBillId: OTHER_BILL_ID }),
    );

    expect(result).toEqual({
      error: "Não foi possível salvar o pagamento.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.updateBillPayment).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("faz hard-delete do pagamento e revalida contas e Dashboard", async () => {
    const result = await deleteBillPaymentAction(
      PAYMENT_ID,
      initialState,
      new FormData(),
    );

    expect(mocks.deleteBillPayment).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      transactionId: PAYMENT_ID,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fixed-bills");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result.success).toBe(true);
  });

  it("retorna o mesmo erro para pagamento ausente, invisível ou rejeitado", async () => {
    mocks.deleteBillPayment
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await deleteBillPaymentAction(
      "66666666-6666-4666-8666-666666666666",
      initialState,
      new FormData(),
    );
    const invisible = await deleteBillPaymentAction(
      "77777777-7777-4777-8777-777777777777",
      initialState,
      new FormData(),
    );

    expect(missing).toEqual(invisible);
    expect(missing.error).toBe("Não foi possível excluir o pagamento.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("não chama repositório quando a validação falha", async () => {
    const result = await createBillPaymentAction(
      FIXED_BILL_ID,
      initialState,
      paymentForm({ amount: "0", paymentMethod: "inventada" }),
    );

    expect(result).toEqual({
      error: "Revise os campos destacados.",
      fieldErrors: {
        amount: "Informe um valor válido.",
        paymentMethod: "Selecione uma forma de pagamento válida.",
      },
      success: false,
    });
    expect(mocks.getFixedBillById).not.toHaveBeenCalled();
    expect(mocks.insertBillPayment).not.toHaveBeenCalled();
  });

  it("falha genericamente quando a sessão não é válida", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired JWT with internal details" },
    });

    const result = await createFixedBillAction(initialState, fixedBillForm());

    expect(result.error).toBe("Não foi possível salvar a conta fixa.");
    expect(JSON.stringify(result)).not.toContain("expired JWT");
    expect(mocks.getCurrentWorkspace).not.toHaveBeenCalled();
    expect(mocks.insertFixedBill).not.toHaveBeenCalled();
  });
});

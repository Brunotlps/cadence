import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  deleteBillPayment,
  deleteFixedBill,
  getBillPaymentById,
  getFixedBillById,
  insertBillPayment,
  insertFixedBill,
  listBillPayments,
  listFixedBills,
  updateBillPayment,
  updateFixedBill,
} from "@/lib/fixed-bills/repository";
import type { NormalizedBillPaymentInput } from "@/lib/fixed-bills/validate-bill-payment";
import type { NormalizedFixedBillInput } from "@/lib/fixed-bills/validate-fixed-bill";

type QueryResult = { data: unknown; error: unknown };

class QueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  not = vi.fn(() => this);
  lte = vi.fn(() => this);
  gte = vi.fn(() => this);
  lt = vi.fn(() => this);
  order = vi.fn(() => this);
  insert = vi.fn(() => this);
  update = vi.fn(() => this);
  delete = vi.fn(() => this);
  single = vi.fn(async () => this.result);
  maybeSingle = vi.fn(async () => this.result);

  constructor(private readonly result: QueryResult) {}

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function fakeClient(result: QueryResult) {
  const query = new QueryDouble(result);
  const from = vi.fn(() => query);
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    query,
  };
}

const fixedBillId = "11111111-1111-4111-8111-111111111111";
const paymentId = "22222222-2222-4222-8222-222222222222";
const createdBy = "33333333-3333-4333-8333-333333333333";

const normalizedBill: NormalizedFixedBillInput = {
  name: "Luz",
  dueDay: 5,
  category: "luz",
  estimatedAmount: "180.00",
  estimatedAmountCents: 18_000,
  autopay: true,
  variableAmount: true,
};

const normalizedPayment: NormalizedBillPaymentInput = {
  amount: "194.32",
  amountCents: 19_432,
  occurredOn: "2026-08-03",
  paymentMethod: "pix",
  fixedBillId,
};

const databaseBill = {
  id: fixedBillId,
  name: "Luz",
  due_day: 5,
  category: "luz",
  autopay: true,
  variable_amount: true,
  estimated_amount: 180,
  started_on: "2026-08-01",
  created_at: "2026-08-01T12:00:00.000Z",
  transactions: [{ count: 3 }],
};

const databasePayment = {
  id: paymentId,
  fixed_bill_id: fixedBillId,
  created_by: createdBy,
  amount: 194.32,
  payment_method: "pix",
  occurred_on: "2026-08-03",
  created_at: "2026-08-03T13:00:00.000Z",
};

describe("repositório de contas fixas", () => {
  it("lista somente contas iniciadas até a referência no workspace", async () => {
    const { client, from, query } = fakeClient({
      data: [databaseBill],
      error: null,
    });

    const result = await listFixedBills(client, {
      workspaceId: "workspace-id",
      throughDate: "2026-08-31",
    });

    expect(from).toHaveBeenCalledWith("fixed_bills");
    expect(query.select).toHaveBeenCalledWith(
      "id, name, due_day, category, autopay, variable_amount, estimated_amount, started_on, created_at, transactions(count)",
    );
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-id");
    expect(query.lte).toHaveBeenCalledWith("started_on", "2026-08-31");
    expect(query.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(result).toEqual({
      data: [
        {
          id: fixedBillId,
          name: "Luz",
          dueDay: 5,
          category: "luz",
          autopay: true,
          variableAmount: true,
          estimatedAmount: "180",
          startedOn: "2026-08-01",
          createdAt: "2026-08-01T12:00:00.000Z",
          linkedPaymentCount: 3,
        },
      ],
      error: null,
    });
  });

  it("lista somente despesas vinculadas dentro do mês e workspace", async () => {
    const { client, from, query } = fakeClient({
      data: [databasePayment],
      error: null,
    });

    const result = await listBillPayments(client, {
      workspaceId: "workspace-id",
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });

    expect(from).toHaveBeenCalledWith("transactions");
    expect(query.select).toHaveBeenCalledWith(
      "id, fixed_bill_id, created_by, amount, payment_method, occurred_on, created_at",
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(2, "kind", "expense");
    expect(query.not).toHaveBeenCalledWith("fixed_bill_id", "is", null);
    expect(query.gte).toHaveBeenCalledWith("occurred_on", "2026-08-01");
    expect(query.lt).toHaveBeenCalledWith("occurred_on", "2026-09-01");
    expect(query.order).toHaveBeenNthCalledWith(1, "occurred_on", {
      ascending: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: false,
    });
    expect(result).toEqual({
      data: [
        {
          id: paymentId,
          fixedBillId,
          createdBy,
          amount: "194.32",
          paymentMethod: "pix",
          occurredOn: "2026-08-03",
          createdAt: "2026-08-03T13:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("busca conta por id e workspace além da RLS", async () => {
    const { client, query } = fakeClient({ data: databaseBill, error: null });

    await getFixedBillById(client, {
      workspaceId: "workspace-id",
      fixedBillId,
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", fixedBillId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("insere workspace do servidor e remove auxiliares em centavos", async () => {
    const { client, query } = fakeClient({ data: databaseBill, error: null });

    await insertFixedBill(client, {
      workspaceId: "workspace-id",
      fixedBill: normalizedBill,
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-id",
      name: "Luz",
      due_day: 5,
      category: "luz",
      autopay: true,
      variable_amount: true,
      estimated_amount: "180.00",
    });
  });

  it("atualiza somente campos editáveis por id e workspace", async () => {
    const { client, query } = fakeClient({ data: databaseBill, error: null });

    await updateFixedBill(client, {
      workspaceId: "workspace-id",
      fixedBillId,
      fixedBill: normalizedBill,
    });

    expect(query.update).toHaveBeenCalledWith({
      name: "Luz",
      due_day: 5,
      category: "luz",
      autopay: true,
      variable_amount: true,
      estimated_amount: "180.00",
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", fixedBillId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
  });

  it("faz hard-delete de conta por id e workspace", async () => {
    const { client, query } = fakeClient({
      data: { id: fixedBillId },
      error: null,
    });

    const result = await deleteFixedBill(client, {
      workspaceId: "workspace-id",
      fixedBillId,
    });

    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", fixedBillId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(result).toEqual({ data: true, error: null });
  });

  it("busca pagamento por id, workspace, tipo e vínculo", async () => {
    const { client, query } = fakeClient({
      data: databasePayment,
      error: null,
    });

    await getBillPaymentById(client, {
      workspaceId: "workspace-id",
      transactionId: paymentId,
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", paymentId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(3, "kind", "expense");
    expect(query.not).toHaveBeenCalledWith("fixed_bill_id", "is", null);
  });

  it("insere pagamento com vínculo e campos derivados no servidor", async () => {
    const { client, query } = fakeClient({
      data: databasePayment,
      error: null,
    });

    await insertBillPayment(client, {
      workspaceId: "workspace-id",
      createdBy,
      category: "luz",
      payment: normalizedPayment,
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-id",
      created_by: createdBy,
      kind: "expense",
      amount: "194.32",
      category: "luz",
      description: null,
      payment_method: "pix",
      goal_id: null,
      fixed_bill_id: fixedBillId,
      occurred_on: "2026-08-03",
    });
  });

  it("edita somente campos do pagamento e limita a linha vinculada", async () => {
    const { client, query } = fakeClient({
      data: databasePayment,
      error: null,
    });

    await updateBillPayment(client, {
      workspaceId: "workspace-id",
      transactionId: paymentId,
      category: "luz",
      payment: normalizedPayment,
    });

    expect(query.update).toHaveBeenCalledWith({
      amount: "194.32",
      category: "luz",
      payment_method: "pix",
      goal_id: null,
      fixed_bill_id: fixedBillId,
      occurred_on: "2026-08-03",
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", paymentId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(3, "kind", "expense");
    expect(query.not).toHaveBeenCalledWith("fixed_bill_id", "is", null);
  });

  it("faz hard-delete somente de despesa vinculada por id e workspace", async () => {
    const { client, query } = fakeClient({
      data: { id: paymentId },
      error: null,
    });

    const result = await deleteBillPayment(client, {
      workspaceId: "workspace-id",
      transactionId: paymentId,
    });

    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", paymentId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(3, "kind", "expense");
    expect(query.not).toHaveBeenCalledWith("fixed_bill_id", "is", null);
    expect(result).toEqual({ data: true, error: null });
  });

  it("não cria oráculo entre registro ausente e invisível", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(
      deleteFixedBill(client, {
        workspaceId: "workspace-id",
        fixedBillId: "hidden-or-missing-id",
      }),
    ).resolves.toEqual({ data: false, error: null });
    await expect(
      deleteBillPayment(client, {
        workspaceId: "workspace-id",
        transactionId: "hidden-or-missing-id",
      }),
    ).resolves.toEqual({ data: false, error: null });
  });

  it("reduz erro do Supabase a código genérico", async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: "permission denied for financial data" },
    });

    const result = await listFixedBills(client, {
      workspaceId: "workspace-id",
      throughDate: "2026-08-31",
    });

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("financial data");
  });
});

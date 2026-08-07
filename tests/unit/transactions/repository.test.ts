import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  deleteTransaction,
  getTransactionById,
  hasAnyTransactions,
  insertTransaction,
  listMonthlyTransactions,
  updateTransaction,
} from "@/lib/transactions/repository";
import type { NormalizedTransactionInput } from "@/lib/transactions/validate-transaction";

type QueryResult = { data: unknown; error: unknown };

class QueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  gte = vi.fn(() => this);
  lt = vi.fn(() => this);
  order = vi.fn(() => this);
  limit = vi.fn(() => this);
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

const normalizedTransaction: NormalizedTransactionInput = {
  amount: "123.45",
  amountCents: 12345,
  category: "alimentacao",
  kind: "expense",
  occurredOn: "2026-08-06",
  description: "Mercado",
  paymentMethod: "pix",
};

const databaseTransaction = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  kind: "expense",
  amount: 123.45,
  category: "alimentacao",
  description: "Mercado",
  payment_method: "pix",
  goal_id: null,
  occurred_on: "2026-08-06",
  created_at: "2026-08-06T12:00:00.000Z",
};

describe("repositório de lançamentos", () => {
  it("lista somente o período e workspace pedidos na ordem do dashboard", async () => {
    const { client, from, query } = fakeClient({
      data: [databaseTransaction],
      error: null,
    });

    const result = await listMonthlyTransactions(client, {
      workspaceId: "workspace-id",
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });

    expect(from).toHaveBeenCalledWith("transactions");
    expect(query.select).toHaveBeenCalledWith(
      "id, kind, amount, category, description, payment_method, goal_id, occurred_on, created_at",
    );
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-id");
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
          id: databaseTransaction.id,
          kind: "expense",
          amount: "123.45",
          category: "alimentacao",
          description: "Mercado",
          paymentMethod: "pix",
          goalId: null,
          occurredOn: "2026-08-06",
          createdAt: "2026-08-06T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("consulta somente um id para distinguir workspace vazio", async () => {
    const { client, from, query } = fakeClient({
      data: [{ id: databaseTransaction.id }],
      error: null,
    });

    const result = await hasAnyTransactions(client, "workspace-id");

    expect(from).toHaveBeenCalledWith("transactions");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-id");
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual({ data: true, error: null });
  });

  it("busca uma edição por id e workspace além da RLS", async () => {
    const { client, query } = fakeClient({
      data: databaseTransaction,
      error: null,
    });

    await getTransactionById(client, {
      workspaceId: "workspace-id",
      transactionId: databaseTransaction.id,
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseTransaction.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("insere identidades do servidor e não persiste o auxiliar amountCents", async () => {
    const { client, query } = fakeClient({
      data: databaseTransaction,
      error: null,
    });

    await insertTransaction(client, {
      workspaceId: "workspace-id",
      createdBy: "user-id",
      transaction: normalizedTransaction,
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-id",
      created_by: "user-id",
      kind: "expense",
      amount: "123.45",
      category: "alimentacao",
      description: "Mercado",
      payment_method: "pix",
      occurred_on: "2026-08-06",
    });
    expect(query.single).toHaveBeenCalledOnce();
  });

  it("atualiza somente campos editáveis e reforça id mais workspace", async () => {
    const { client, query } = fakeClient({
      data: databaseTransaction,
      error: null,
    });

    await updateTransaction(client, {
      workspaceId: "workspace-id",
      transactionId: databaseTransaction.id,
      transaction: normalizedTransaction,
    });

    expect(query.update).toHaveBeenCalledWith({
      kind: "expense",
      amount: "123.45",
      category: "alimentacao",
      description: "Mercado",
      payment_method: "pix",
      occurred_on: "2026-08-06",
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseTransaction.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("faz hard-delete filtrando id e workspace", async () => {
    const { client, query } = fakeClient({
      data: { id: databaseTransaction.id },
      error: null,
    });

    const result = await deleteTransaction(client, {
      workspaceId: "workspace-id",
      transactionId: databaseTransaction.id,
    });

    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseTransaction.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(result).toEqual({ data: true, error: null });
  });

  it("não cria oráculo entre registro ausente e invisível no delete", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(
      deleteTransaction(client, {
        workspaceId: "workspace-id",
        transactionId: "hidden-or-missing-id",
      }),
    ).resolves.toEqual({ data: false, error: null });
  });

  it("substitui erros do Supabase por um código genérico", async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: "permission denied for secret row" },
    });

    const result = await listMonthlyTransactions(client, {
      workspaceId: "workspace-id",
      start: "2026-08-01",
      endExclusive: "2026-09-01",
    });

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("permission denied");
  });
});

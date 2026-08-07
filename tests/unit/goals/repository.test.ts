import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  deleteContribution,
  deleteGoal,
  getContributionById,
  getGoalById,
  insertContribution,
  insertGoal,
  listGoalContributions,
  listGoals,
  updateContribution,
  updateGoal,
} from "@/lib/goals/repository";
import type { NormalizedContributionInput } from "@/lib/goals/validate-contribution";
import type { NormalizedGoalInput } from "@/lib/goals/validate-goal";

type QueryResult = { data: unknown; error: unknown };

class QueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  not = vi.fn(() => this);
  lte = vi.fn(() => this);
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

const normalizedGoal: NormalizedGoalInput = {
  name: "Reserva",
  targetAmount: "5000.00",
  targetAmountCents: 500_000,
  suggestedMonthly: "500.00",
  suggestedMonthlyCents: 50_000,
};

const normalizedContribution: NormalizedContributionInput = {
  amount: "250.00",
  amountCents: 25_000,
  occurredOn: "2026-08-07",
  goalId: "11111111-1111-4111-8111-111111111111",
};

const databaseGoal = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reserva",
  target_amount: 5000,
  suggested_monthly: 500,
  started_on: "2026-08-07",
  created_at: "2026-08-07T12:00:00.000Z",
};

const databaseContribution = {
  id: "22222222-2222-4222-8222-222222222222",
  goal_id: databaseGoal.id,
  created_by: "33333333-3333-4333-8333-333333333333",
  amount: 250,
  occurred_on: "2026-08-07",
  created_at: "2026-08-07T13:00:00.000Z",
};

describe("repositório de metas", () => {
  it("lista somente metas do workspace na ordem mais recente", async () => {
    const { client, from, query } = fakeClient({
      data: [databaseGoal],
      error: null,
    });

    const result = await listGoals(client, "workspace-id");

    expect(from).toHaveBeenCalledWith("goals");
    expect(query.select).toHaveBeenCalledWith(
      "id, name, target_amount, suggested_monthly, started_on, created_at",
    );
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-id");
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result).toEqual({
      data: [
        {
          id: databaseGoal.id,
          name: "Reserva",
          targetAmount: "5000",
          suggestedMonthly: "500",
          startedOn: "2026-08-07",
          createdAt: "2026-08-07T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("lista somente aportes ocorridos até a referência e vinculados a metas", async () => {
    const { client, from, query } = fakeClient({
      data: [databaseContribution],
      error: null,
    });

    const result = await listGoalContributions(client, {
      workspaceId: "workspace-id",
      throughDate: "2026-08-07",
    });

    expect(from).toHaveBeenCalledWith("transactions");
    expect(query.select).toHaveBeenCalledWith(
      "id, goal_id, created_by, amount, occurred_on, created_at",
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(2, "kind", "contribution");
    expect(query.not).toHaveBeenCalledWith("goal_id", "is", null);
    expect(query.lte).toHaveBeenCalledWith("occurred_on", "2026-08-07");
    expect(query.order).toHaveBeenNthCalledWith(1, "occurred_on", {
      ascending: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: false,
    });
    expect(result).toEqual({
      data: [
        {
          id: databaseContribution.id,
          goalId: databaseGoal.id,
          createdBy: databaseContribution.created_by,
          amount: "250",
          occurredOn: "2026-08-07",
          createdAt: "2026-08-07T13:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("busca meta por id e workspace além da RLS", async () => {
    const { client, query } = fakeClient({ data: databaseGoal, error: null });

    await getGoalById(client, {
      workspaceId: "workspace-id",
      goalId: databaseGoal.id,
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseGoal.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("insere workspace do servidor e remove auxiliares em centavos", async () => {
    const { client, query } = fakeClient({ data: databaseGoal, error: null });

    await insertGoal(client, {
      workspaceId: "workspace-id",
      goal: normalizedGoal,
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-id",
      name: "Reserva",
      target_amount: "5000.00",
      suggested_monthly: "500.00",
    });
    expect(query.single).toHaveBeenCalledOnce();
  });

  it("atualiza somente campos editáveis por id e workspace", async () => {
    const { client, query } = fakeClient({ data: databaseGoal, error: null });

    await updateGoal(client, {
      workspaceId: "workspace-id",
      goalId: databaseGoal.id,
      goal: normalizedGoal,
    });

    expect(query.update).toHaveBeenCalledWith({
      name: "Reserva",
      target_amount: "5000.00",
      suggested_monthly: "500.00",
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseGoal.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
  });

  it("faz hard-delete de meta por id e workspace", async () => {
    const { client, query } = fakeClient({
      data: { id: databaseGoal.id },
      error: null,
    });

    const result = await deleteGoal(client, {
      workspaceId: "workspace-id",
      goalId: databaseGoal.id,
    });

    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseGoal.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(result).toEqual({ data: true, error: null });
  });

  it("busca aporte por id, workspace e tipo", async () => {
    const { client, query } = fakeClient({
      data: databaseContribution,
      error: null,
    });

    await getContributionById(client, {
      workspaceId: "workspace-id",
      transactionId: databaseContribution.id,
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseContribution.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(3, "kind", "contribution");
  });

  it("insere aporte com campos derivados e identidades do servidor", async () => {
    const { client, query } = fakeClient({
      data: databaseContribution,
      error: null,
    });

    await insertContribution(client, {
      workspaceId: "workspace-id",
      createdBy: databaseContribution.created_by,
      contribution: normalizedContribution,
    });

    expect(query.insert).toHaveBeenCalledWith({
      workspace_id: "workspace-id",
      created_by: databaseContribution.created_by,
      kind: "contribution",
      amount: "250.00",
      category: null,
      description: null,
      payment_method: null,
      goal_id: databaseGoal.id,
      occurred_on: "2026-08-07",
    });
  });

  it("edita valor, data e meta do aporte sem tocar em campos sistêmicos", async () => {
    const { client, query } = fakeClient({
      data: databaseContribution,
      error: null,
    });

    await updateContribution(client, {
      workspaceId: "workspace-id",
      transactionId: databaseContribution.id,
      contribution: normalizedContribution,
    });

    expect(query.update).toHaveBeenCalledWith({
      amount: "250.00",
      goal_id: databaseGoal.id,
      occurred_on: "2026-08-07",
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseContribution.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(3, "kind", "contribution");
  });

  it("faz hard-delete de aporte por id, workspace e tipo", async () => {
    const { client, query } = fakeClient({
      data: { id: databaseContribution.id },
      error: null,
    });

    const result = await deleteContribution(client, {
      workspaceId: "workspace-id",
      transactionId: databaseContribution.id,
    });

    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", databaseContribution.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "workspace_id", "workspace-id");
    expect(query.eq).toHaveBeenNthCalledWith(3, "kind", "contribution");
    expect(result).toEqual({ data: true, error: null });
  });

  it("não cria oráculo entre registro ausente e invisível", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(
      deleteGoal(client, {
        workspaceId: "workspace-id",
        goalId: "hidden-or-missing-id",
      }),
    ).resolves.toEqual({ data: false, error: null });
    await expect(
      deleteContribution(client, {
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

    const result = await listGoals(client, "workspace-id");

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("financial data");
  });
});

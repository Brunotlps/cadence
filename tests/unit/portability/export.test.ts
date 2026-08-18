import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { exportUserData } from "@/lib/portability/export";

type QueryResult = { data: unknown; error: unknown };
type TableName =
  | "profiles"
  | "workspaces"
  | "workspace_members"
  | "transactions"
  | "goals"
  | "fixed_bills";

class QueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  order = vi.fn(() => this);
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

function fakeClient(results: Record<TableName, QueryResult>) {
  const queries = Object.fromEntries(
    Object.entries(results).map(([table, result]) => [
      table,
      new QueryDouble(result),
    ]),
  ) as Record<TableName, QueryDouble>;
  const from = vi.fn((table: TableName) => queries[table]);

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    queries,
  };
}

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";

function successfulResults(): Record<TableName, QueryResult> {
  return {
    profiles: {
      data: {
        id: userId,
        display_name: "Pessoa solicitante",
        accent_color: "verde",
        created_at: "2026-08-01T12:00:00.000Z",
      },
      error: null,
    },
    workspaces: {
      data: [
        {
          id: workspaceId,
          name: "Casa",
          created_at: "2026-08-01T12:00:00.000Z",
        },
      ],
      error: null,
    },
    workspace_members: {
      data: [
        {
          workspace_id: workspaceId,
          user_id: userId,
          role: "owner",
          created_at: "2026-08-01T12:00:00.000Z",
        },
      ],
      error: null,
    },
    transactions: {
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          workspace_id: workspaceId,
          created_by: userId,
          kind: "expense",
          amount: 1234.5,
          category: "alimentacao",
          description: "Mercado",
          payment_method: "pix",
          goal_id: null,
          fixed_bill_id: null,
          occurred_on: "2026-08-02",
          created_at: "2026-08-02T12:00:00.000Z",
          non_exportable: "ignored",
        },
      ],
      error: null,
    },
    goals: {
      data: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          workspace_id: workspaceId,
          name: "Reserva",
          target_amount: 10000,
          suggested_monthly: 500,
          started_on: "2026-08-01",
          created_at: "2026-08-01T12:00:00.000Z",
        },
      ],
      error: null,
    },
    fixed_bills: {
      data: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          workspace_id: workspaceId,
          name: "Luz",
          due_day: 10,
          category: "luz",
          autopay: true,
          variable_amount: false,
          estimated_amount: 210.75,
          started_on: "2026-08-01",
          created_at: "2026-08-01T12:00:00.000Z",
        },
      ],
      error: null,
    },
  };
}

describe("exportação de portabilidade", () => {
  it("seleciona somente colunas exportáveis, o perfil da sessão e serializa numeric como string", async () => {
    const { client, from, queries } = fakeClient(successfulResults());

    const result = await exportUserData(client, userId);

    expect(from).toHaveBeenCalledWith("profiles");
    expect(queries.profiles.select).toHaveBeenCalledWith(
      "id, display_name, accent_color, created_at",
    );
    expect(queries.profiles.eq).toHaveBeenCalledWith("id", userId);
    expect(queries.workspaces.select).toHaveBeenCalledWith(
      "id, name, created_at",
    );
    expect(queries.workspace_members.select).toHaveBeenCalledWith(
      "workspace_id, user_id, role, created_at",
    );
    expect(queries.transactions.select).toHaveBeenCalledWith(
      "id, workspace_id, created_by, kind, amount, category, description, payment_method, goal_id, fixed_bill_id, occurred_on, created_at",
    );
    expect(queries.goals.select).toHaveBeenCalledWith(
      "id, workspace_id, name, target_amount, suggested_monthly, started_on, created_at",
    );
    expect(queries.fixed_bills.select).toHaveBeenCalledWith(
      "id, workspace_id, name, due_day, category, autopay, variable_amount, estimated_amount, started_on, created_at",
    );
    expect(result).toEqual({
      data: {
        profile: successfulResults().profiles.data,
        workspaces: successfulResults().workspaces.data,
        workspace_members: successfulResults().workspace_members.data,
        transactions: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            workspace_id: workspaceId,
            created_by: userId,
            kind: "expense",
            amount: "1234.50",
            category: "alimentacao",
            description: "Mercado",
            payment_method: "pix",
            goal_id: null,
            fixed_bill_id: null,
            occurred_on: "2026-08-02",
            created_at: "2026-08-02T12:00:00.000Z",
          },
        ],
        goals: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            workspace_id: workspaceId,
            name: "Reserva",
            target_amount: "10000.00",
            suggested_monthly: "500.00",
            started_on: "2026-08-01",
            created_at: "2026-08-01T12:00:00.000Z",
          },
        ],
        fixed_bills: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            workspace_id: workspaceId,
            name: "Luz",
            due_day: 10,
            category: "luz",
            autopay: true,
            variable_amount: false,
            estimated_amount: "210.75",
            started_on: "2026-08-01",
            created_at: "2026-08-01T12:00:00.000Z",
          },
        ],
      },
      error: null,
    });
  });

  it("não expõe detalhes da consulta quando qualquer leitura falha", async () => {
    const results = successfulResults();
    results.transactions = {
      data: null,
      error: { message: "permission denied for someone@example.com" },
    };
    const { client } = fakeClient(results);

    const result = await exportUserData(client, userId);

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("someone@example.com");
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getCurrentWorkspace } from "@/lib/workspace/repository";

type QueryResult = { data: unknown; error: unknown };

class QueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  order = vi.fn(() => this);
  limit = vi.fn(() => this);
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

describe("repositório de workspace", () => {
  it("resolve deterministicamente o workspace visível do usuário", async () => {
    const { client, from, query } = fakeClient({
      data: {
        workspace_id: "11111111-1111-4111-8111-111111111111",
        workspaces: { name: "Casa" },
      },
      error: null,
    });

    const result = await getCurrentWorkspace(
      client,
      "22222222-2222-4222-8222-222222222222",
    );

    expect(from).toHaveBeenCalledWith("workspace_members");
    expect(query.select).toHaveBeenCalledWith("workspace_id, workspaces(name)");
    expect(query.eq).toHaveBeenCalledWith(
      "user_id",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Casa",
      },
      error: null,
    });
  });

  it("representa ausência de membership sem tratá-la como falha", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(getCurrentWorkspace(client, "user-id")).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it("reduz falhas de query a um erro genérico", async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: "permission denied with internal details" },
    });

    const result = await getCurrentWorkspace(client, "user-id");

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("permission denied");
  });
});

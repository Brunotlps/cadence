import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getCurrentWorkspace, listWorkspaceMembers } from "@/lib/workspace/repository";

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

// Duas tabelas em sequência (workspace_members, depois profiles) — cada
// chamada de `.from(table)` devolve sua própria QueryDouble encadeável.
class MultiTableQueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  in = vi.fn(() => this);
  order = vi.fn(() => this);

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

function fakeMultiTableClient(resultsByTable: Record<string, QueryResult>) {
  const queriesByTable: Record<string, MultiTableQueryDouble> = {};
  const from = vi.fn((table: string) => {
    const query = new MultiTableQueryDouble(resultsByTable[table]);
    queriesByTable[table] = query;
    return query;
  });

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    queriesByTable,
  };
}

describe("listWorkspaceMembers", () => {
  it("combina workspace_members e profiles preservando a ordem de entrada", async () => {
    const { client, from } = fakeMultiTableClient({
      workspace_members: {
        data: [{ user_id: "user-a" }, { user_id: "user-b" }],
        error: null,
      },
      profiles: {
        data: [
          { id: "user-b", display_name: "Bruno", accent_color: "verde" },
          { id: "user-a", display_name: "Ana", accent_color: "rosa" },
        ],
        error: null,
      },
    });

    const result = await listWorkspaceMembers(client, "workspace-1");

    expect(from).toHaveBeenCalledWith("workspace_members");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(result).toEqual({
      data: [
        { userId: "user-a", displayName: "Ana", accentColor: "rosa" },
        { userId: "user-b", displayName: "Bruno", accentColor: "verde" },
      ],
      error: null,
    });
  });

  it("lida com display_name nulo sem quebrar", async () => {
    const { client } = fakeMultiTableClient({
      workspace_members: { data: [{ user_id: "user-a" }], error: null },
      profiles: {
        data: [{ id: "user-a", display_name: null, accent_color: "preto" }],
        error: null,
      },
    });

    const result = await listWorkspaceMembers(client, "workspace-1");

    expect(result).toEqual({
      data: [{ userId: "user-a", displayName: null, accentColor: "preto" }],
      error: null,
    });
  });

  it("omite membros cujo profile não veio na segunda consulta", async () => {
    const { client } = fakeMultiTableClient({
      workspace_members: {
        data: [{ user_id: "user-a" }, { user_id: "user-b" }],
        error: null,
      },
      profiles: {
        data: [{ id: "user-a", display_name: "Ana", accent_color: "rosa" }],
        error: null,
      },
    });

    const result = await listWorkspaceMembers(client, "workspace-1");

    expect(result).toEqual({
      data: [{ userId: "user-a", displayName: "Ana", accentColor: "rosa" }],
      error: null,
    });
  });

  it("retorna lista vazia sem consultar profiles quando não há membros", async () => {
    const { client, from } = fakeMultiTableClient({
      workspace_members: { data: [], error: null },
      profiles: { data: [], error: null },
    });

    const result = await listWorkspaceMembers(client, "workspace-1");

    expect(result).toEqual({ data: [], error: null });
    expect(from).not.toHaveBeenCalledWith("profiles");
  });

  it("reduz falha na consulta de workspace_members a um erro genérico", async () => {
    const { client } = fakeMultiTableClient({
      workspace_members: {
        data: null,
        error: { message: "permission denied with internal details" },
      },
      profiles: { data: [], error: null },
    });

    const result = await listWorkspaceMembers(client, "workspace-1");

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("permission denied");
  });

  it("reduz falha na consulta de profiles a um erro genérico", async () => {
    const { client } = fakeMultiTableClient({
      workspace_members: { data: [{ user_id: "user-a" }], error: null },
      profiles: {
        data: null,
        error: { message: "permission denied with internal details" },
      },
    });

    const result = await listWorkspaceMembers(client, "workspace-1");

    expect(result).toEqual({ data: null, error: "query_failed" });
  });
});

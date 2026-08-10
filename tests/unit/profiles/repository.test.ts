import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  getProfileAccentColor,
  updateProfileAccentColor,
} from "@/lib/profiles/repository";

type QueryResult = { data: unknown; error: unknown };

class QueryDouble implements PromiseLike<QueryResult> {
  select = vi.fn(() => this);
  eq = vi.fn(() => this);
  update = vi.fn(() => this);
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

describe("repositório da preferência de perfil", () => {
  it("lê somente a cor do perfil pelo id autenticado além da RLS", async () => {
    const { client, from, query } = fakeClient({
      data: { accent_color: "rosa" },
      error: null,
    });

    const result = await getProfileAccentColor(client, "server-user-id");

    expect(from).toHaveBeenCalledWith("profiles");
    expect(query.select).toHaveBeenCalledWith("accent_color");
    expect(query.eq).toHaveBeenCalledWith("id", "server-user-id");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ data: "rosa", error: null });
  });

  it("representa perfil ausente ou invisível sem criar um oráculo", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(
      getProfileAccentColor(client, "hidden-or-missing-id"),
    ).resolves.toEqual({ data: null, error: null });
  });

  it("atualiza somente accent_color e filtra pelo id do servidor", async () => {
    const { client, query } = fakeClient({
      data: { accent_color: "preto" },
      error: null,
    });

    const result = await updateProfileAccentColor(client, {
      userId: "server-user-id",
      accentColor: "preto",
    });

    expect(query.update).toHaveBeenCalledWith({ accent_color: "preto" });
    expect(query.eq).toHaveBeenCalledWith("id", "server-user-id");
    expect(query.select).toHaveBeenCalledWith("accent_color");
    expect(query.maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ data: "preto", error: null });
  });

  it("torna update ausente e invisível indistinguíveis", async () => {
    const { client } = fakeClient({ data: null, error: null });

    await expect(
      updateProfileAccentColor(client, {
        userId: "hidden-or-missing-id",
        accentColor: "verde",
      }),
    ).resolves.toEqual({ data: null, error: null });
  });

  it("reduz falha do Supabase a código genérico sem vazar detalhes", async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: "permission denied for profile user@example.com" },
    });

    const result = await getProfileAccentColor(client, "server-user-id");

    expect(result).toEqual({ data: null, error: "query_failed" });
    expect(JSON.stringify(result)).not.toContain("user@example.com");
    expect(JSON.stringify(result)).not.toContain("permission denied");
  });

  it("trata código inesperado do banco como falha genérica", async () => {
    const { client } = fakeClient({
      data: { accent_color: "azul" },
      error: null,
    });

    await expect(
      getProfileAccentColor(client, "server-user-id"),
    ).resolves.toEqual({ data: null, error: "query_failed" });
  });
});

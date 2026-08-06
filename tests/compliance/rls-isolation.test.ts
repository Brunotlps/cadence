import { config } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

// Roda só quando as credenciais Supabase estão em .env.local. No CI, sem os
// secrets configurados, os testes são pulados em vez de falhar.
describe.skipIf(!hasSupabaseTestEnv())("Isolamento por workspace (RLS)", () => {
  let clientA: SupabaseClient; // membro do workspace A
  let clientB: SupabaseClient; // membro de um workspace separado
  let userAId: string;
  let userBId: string;
  let workspaceAId: string;

  beforeAll(async () => {
    const userA = await createConfirmedTestUser("rls-a");
    const userB = await createConfirmedTestUser("rls-b");
    userAId = userA.id;
    userBId = userB.id;

    clientA = createAnonTestClient();
    clientB = createAnonTestClient();

    const { error: signInAError } = await clientA.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    if (signInAError) throw signInAError;

    const { error: signInBError } = await clientB.auth.signInWithPassword({
      email: userB.email,
      password: userB.password,
    });
    if (signInBError) throw signInBError;

    const { data: workspaceId, error: workspaceError } = await clientA.rpc(
      "create_workspace_with_owner",
      { workspace_name: "RLS test workspace A" },
    );
    if (workspaceError) throw workspaceError;
    workspaceAId = workspaceId as string;

    const { error: insertError } = await clientA.from("transactions").insert({
      workspace_id: workspaceAId,
      created_by: userAId,
      kind: "expense",
      amount: "10.00",
      category: "alimentacao",
      occurred_on: "2026-01-01",
    });
    if (insertError) throw insertError;
  }, 20000);

  afterAll(async () => {
    await deleteTestAccount(userAId);
    await deleteTestAccount(userBId);
  }, 20000);

  it("usuário A consegue ler sua própria transação", async () => {
    const { data, error } = await clientA
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspaceAId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("usuário B NÃO lê transações do workspace A", async () => {
    const { data, error } = await clientB
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspaceAId);

    expect(error).toBeNull();
    expect(data).toEqual([]); // RLS filtra: nada retorna
  });

  it("usuário B NÃO consegue inserir no workspace A", async () => {
    const { error } = await clientB.from("transactions").insert({
      workspace_id: workspaceAId,
      created_by: userBId,
      kind: "expense",
      amount: "10.00",
      category: "alimentacao",
      occurred_on: "2026-01-01",
    });

    expect(error).not.toBeNull(); // policy de insert bloqueia
  });

  it("usuário B NÃO lê os membros do workspace A", async () => {
    const { data, error } = await clientB
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceAId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

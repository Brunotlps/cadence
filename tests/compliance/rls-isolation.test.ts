// Pseudocódigo ilustrativo — adaptar ao seu client de teste (ex: @supabase/supabase-js
// com dois usuários autenticados distintos).

import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// TODO: implementar quando o setup de teste do Supabase existir.
describe.skip("Isolamento por workspace (RLS)", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reservado para o setup de dois usuários quando implementado
  let clientA: SupabaseClient; // usuário Bruno, workspace A
  let clientB: SupabaseClient; // usuário Alyne, workspace B (separado)
  let workspaceAId: string;

  beforeAll(async () => {
    // Autentica dois usuários em workspaces diferentes e captura o id do workspace A.
    // (setup omitido — usar contas de teste dedicadas)
  });

  it("usuário B NÃO lê transações do workspace A", async () => {
    const { data } = await clientB
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspaceAId);
    expect(data).toEqual([]); // RLS filtra: nada retorna
  });

  it("usuário B NÃO consegue inserir no workspace A", async () => {
    const { error } = await clientB.from("transactions").insert({
      workspace_id: workspaceAId,
      kind: "expense",
      amount: "10.00",
      occurred_on: "2026-01-01",
      created_by: "qualquer",
    });
    expect(error).not.toBeNull(); // policy de insert bloqueia
  });
});
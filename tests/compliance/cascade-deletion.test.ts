import { describe, it, expect } from "vitest";

describe("Apagamento em cascata", () => {
  it("apagar workspace apaga transações, contas fixas e metas", async () => {
    // 1. cria workspace + 1 transação + 1 conta fixa + 1 meta (via service-role no setup)
    // 2. apaga o workspace
    // 3. verifica que as três tabelas não têm mais linhas com aquele workspace_id
    // expect(counts).toEqual({ transactions: 0, fixed_bills: 0, goals: 0 });
  });

  it("apagar conta remove participações e workspaces órfãos", async () => {
    // 1. cria usuário único em um workspace novo
    // 2. chama handle_account_deletion(userId)
    // 3. verifica que o workspace foi apagado e nada ficou órfão
  });
});
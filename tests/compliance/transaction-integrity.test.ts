import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

const BASE_TRANSACTION = {
  kind: "expense",
  amount: "10.00",
  category: "alimentacao",
  occurred_on: "2026-08-05",
};

// Cobre as garantias de banco necessárias quando a Etapa 06 expuser CRUD real:
// autoria derivada da sessão, campos de ownership imutáveis, constraints do domínio,
// isolamento de update/delete e hard-delete sem retenção residual.
describe.skipIf(!hasSupabaseTestEnv())(
  "Integridade e autorização de lançamentos",
  () => {
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let userAId: string;
    let userBId: string;
    let workspaceAId: string;
    let secondWorkspaceAId: string;

    beforeAll(async () => {
      const userA = await createConfirmedTestUser("transactions-integrity-a");
      const userB = await createConfirmedTestUser("transactions-integrity-b");
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

      const { data: workspaceA, error: workspaceAError } = await clientA.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Transaction integrity A" },
      );
      if (workspaceAError) throw workspaceAError;
      workspaceAId = workspaceA as string;

      const { data: secondWorkspaceA, error: secondWorkspaceAError } =
        await clientA.rpc("create_workspace_with_owner", {
          workspace_name: "Transaction integrity A second",
        });
      if (secondWorkspaceAError) throw secondWorkspaceAError;
      secondWorkspaceAId = secondWorkspaceA as string;

      const { error: workspaceBError } = await clientB.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Transaction integrity B" },
      );
      if (workspaceBError) throw workspaceBError;
    }, 30000);

    afterAll(async () => {
      await deleteTestAccount(userAId);
      await deleteTestAccount(userBId);
    }, 30000);

    async function insertTransaction(
      overrides: Record<string, unknown> = {},
    ): Promise<Record<string, unknown>> {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_TRANSACTION,
          workspace_id: workspaceAId,
          created_by: userAId,
          ...overrides,
        })
        .select("id, workspace_id, created_by, created_at")
        .single();

      if (error) throw error;
      return data as Record<string, unknown>;
    }

    async function expectCheckViolation(overrides: Record<string, unknown>) {
      const { error } = await clientA.from("transactions").insert({
        ...BASE_TRANSACTION,
        workspace_id: workspaceAId,
        created_by: userAId,
        ...overrides,
      });

      expect(error?.code).toBe("23514");
    }

    it("rejeita insert com created_by diferente da sessão autenticada", async () => {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_TRANSACTION,
          workspace_id: workspaceAId,
          created_by: userBId,
        })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("impede outro workspace de ler, atualizar ou excluir o lançamento", async () => {
      const transaction = await insertTransaction({ description: "original" });
      const transactionId = transaction.id as string;

      const { data: readData, error: readError } = await clientB
        .from("transactions")
        .select("id")
        .eq("id", transactionId);
      expect(readError).toBeNull();
      expect(readData).toEqual([]);

      const { data: updateData, error: updateError } = await clientB
        .from("transactions")
        .update({ description: "forjada" })
        .eq("id", transactionId)
        .select("id");
      expect(updateError).toBeNull();
      expect(updateData).toEqual([]);

      const { data: deleteData, error: deleteError } = await clientB
        .from("transactions")
        .delete()
        .eq("id", transactionId)
        .select("id");
      expect(deleteError).toBeNull();
      expect(deleteData).toEqual([]);

      const { data: preserved, error: preservedError } = await clientA
        .from("transactions")
        .select("description")
        .eq("id", transactionId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved?.description).toBe("original");
    });

    it("permite editar campos de negócio sem alterar ownership", async () => {
      const transaction = await insertTransaction({ description: "antes" });

      const { data, error } = await clientA
        .from("transactions")
        .update({ description: "depois", amount: "20.00" })
        .eq("id", transaction.id)
        .select("description, amount")
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({ description: "depois", amount: 20 });
    });

    it("impede mover um lançamento entre workspaces do mesmo membro", async () => {
      const transaction = await insertTransaction();

      const { error } = await clientA
        .from("transactions")
        .update({ workspace_id: secondWorkspaceAId })
        .eq("id", transaction.id);

      expect(error).not.toBeNull();

      const { data: preserved } = await clientA
        .from("transactions")
        .select("workspace_id")
        .eq("id", transaction.id)
        .single();
      expect(preserved?.workspace_id).toBe(workspaceAId);
    });

    it("impede alterar created_by depois da criação", async () => {
      const transaction = await insertTransaction();

      const { error } = await clientA
        .from("transactions")
        .update({ created_by: userBId })
        .eq("id", transaction.id);

      expect(error).not.toBeNull();

      const { data: preserved } = await clientA
        .from("transactions")
        .select("created_by")
        .eq("id", transaction.id)
        .single();
      expect(preserved?.created_by).toBe(userAId);
    });

    it("impede alterar created_at depois da criação", async () => {
      const transaction = await insertTransaction();
      const originalCreatedAt = transaction.created_at;

      const { error } = await clientA
        .from("transactions")
        .update({ created_at: "2000-01-01T00:00:00.000Z" })
        .eq("id", transaction.id);

      expect(error).not.toBeNull();

      const { data: preserved } = await clientA
        .from("transactions")
        .select("created_at")
        .eq("id", transaction.id)
        .single();
      expect(preserved?.created_at).toBe(originalCreatedAt);
    });

    it("aceita os novos campos e códigos válidos", async () => {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_TRANSACTION,
          workspace_id: workspaceAId,
          created_by: userAId,
          payment_method: "pix",
          description: "Mercado do mês",
        })
        .select("category, kind, payment_method, description")
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        category: "alimentacao",
        kind: "expense",
        payment_method: "pix",
        description: "Mercado do mês",
      });
    });

    it("mantém contribution válido e fora das categorias desta etapa", async () => {
      const { error } = await clientA.from("transactions").insert({
        workspace_id: workspaceAId,
        created_by: userAId,
        kind: "contribution",
        amount: "30.00",
        category: null,
        occurred_on: "2026-08-05",
      });

      expect(error).toBeNull();
    });

    it.each([
      ["kind desconhecido", { kind: "refund" }],
      ["valor zero", { amount: "0.00" }],
      ["valor negativo", { amount: "-1.00" }],
      ["valor não numérico do Postgres", { amount: "NaN" }],
      ["categoria ausente em despesa", { category: null }],
      ["categoria desconhecida", { category: "viagem" }],
      ["Renda marcada como despesa", { category: "renda" }],
      [
        "receita fora de Renda",
        { kind: "income", category: "alimentacao" },
      ],
      ["forma de pagamento desconhecida", { payment_method: "crypto" }],
      ["descrição acima de 200 caracteres", { description: "a".repeat(201) }],
    ])("rejeita %s por constraint do banco", async (_label, overrides) => {
      await expectCheckViolation(overrides);
    });

    it("faz hard-delete e não deixa cópia residual da linha", async () => {
      const admin = createTestAdminClient();
      const transaction = await insertTransaction();

      const { data, error } = await clientA
        .from("transactions")
        .delete()
        .eq("id", transaction.id)
        .select("id")
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBe(transaction.id);

      const { data: residual, error: residualError } = await admin
        .from("transactions")
        .select("id")
        .eq("id", transaction.id);
      expect(residualError).toBeNull();
      expect(residual).toEqual([]);
    });
  },
);

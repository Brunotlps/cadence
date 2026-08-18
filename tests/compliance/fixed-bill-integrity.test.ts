import { config } from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTodayInSaoPaulo } from "@/lib/transactions/civil-date";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

const BASE_FIXED_BILL = {
  name: "Conta de luz",
  due_day: 5,
  category: "luz",
  estimated_amount: "180.00",
  autopay: false,
  variable_amount: true,
};

const BASE_PAYMENT = {
  kind: "expense",
  amount: "194.32",
  category: "luz",
  occurred_on: "2026-08-05",
};

describe.skipIf(!hasSupabaseTestEnv())(
  "Integridade e autorização de contas fixas e pagamentos",
  () => {
    let admin: SupabaseClient;
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let userAId: string;
    let userBId: string;
    let workspaceAId: string;
    let workspaceBId: string;

    beforeAll(async () => {
      admin = createTestAdminClient();
      const userA = await createConfirmedTestUser("bills-integrity-a");
      const userB = await createConfirmedTestUser("bills-integrity-b");
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
        { workspace_name: "Bill integrity A" },
      );
      if (workspaceAError) throw workspaceAError;
      workspaceAId = workspaceA as string;

      const { data: workspaceB, error: workspaceBError } = await clientB.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Bill integrity B" },
      );
      if (workspaceBError) throw workspaceBError;
      workspaceBId = workspaceB as string;
    }, 30000);

    afterAll(async () => {
      await deleteTestAccount(userAId);
      await deleteTestAccount(userBId);
    }, 30000);

    async function insertFixedBill(
      workspaceId: string,
      overrides: Record<string, unknown> = {},
    ): Promise<string> {
      return insertFixedBillFor(clientA, workspaceId, overrides);
    }

    async function insertFixedBillFor(
      client: SupabaseClient,
      workspaceId: string,
      overrides: Record<string, unknown> = {},
    ): Promise<string> {
      const { data, error } = await client
        .from("fixed_bills")
        .insert({
          ...BASE_FIXED_BILL,
          workspace_id: workspaceId,
          ...overrides,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id as string;
    }

    async function insertPayment(
      fixedBillId: string | null,
      overrides: Record<string, unknown> = {},
    ): Promise<string> {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_PAYMENT,
          workspace_id: workspaceAId,
          created_by: userAId,
          fixed_bill_id: fixedBillId,
          ...overrides,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id as string;
    }

    it("permite CRUD legítimo dos campos editáveis da conta fixa", async () => {
      const billId = await insertFixedBill(workspaceAId, { name: "Antes" });

      const { data, error } = await clientA
        .from("fixed_bills")
        .update({
          name: "Depois",
          due_day: 20,
          category: "internet",
          autopay: true,
          variable_amount: false,
          estimated_amount: "120.00",
        })
        .eq("id", billId)
        .eq("workspace_id", workspaceAId)
        .select(
          "name, due_day, category, autopay, variable_amount, estimated_amount",
        )
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        name: "Depois",
        due_day: 20,
        category: "internet",
        autopay: true,
        variable_amount: false,
        estimated_amount: 120,
      });
    });

    it("impede outro workspace de ler, atualizar ou excluir a conta fixa", async () => {
      const billId = await insertFixedBill(workspaceAId);

      const { data: readData, error: readError } = await clientB
        .from("fixed_bills")
        .select("id")
        .eq("id", billId);
      expect(readError).toBeNull();
      expect(readData).toEqual([]);

      const { data: updateData, error: updateError } = await clientB
        .from("fixed_bills")
        .update({ name: "Forjada" })
        .eq("id", billId)
        .select("id");
      expect(updateError).toBeNull();
      expect(updateData).toEqual([]);

      const { data: deleteData, error: deleteError } = await clientB
        .from("fixed_bills")
        .delete()
        .eq("id", billId)
        .select("id");
      expect(deleteError).toBeNull();
      expect(deleteData).toEqual([]);
    });

    it("impede inserir conta fixa em workspace do qual o usuário não é membro", async () => {
      const { data, error } = await clientA
        .from("fixed_bills")
        .insert({ ...BASE_FIXED_BILL, workspace_id: workspaceBId })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it.each([
      ["nome vazio", { name: "" }],
      ["nome só com espaços", { name: "   " }],
      ["nome acima do limite", { name: "a".repeat(101) }],
      ["dia zero", { due_day: 0 }],
      ["dia acima de 31", { due_day: 32 }],
      ["dia negativo", { due_day: -1 }],
      ["estimativa zero", { estimated_amount: "0.00" }],
      ["estimativa negativa", { estimated_amount: "-1.00" }],
      ["estimativa NaN", { estimated_amount: "NaN" }],
      ["categoria de receita", { category: "renda" }],
      ["categoria fora do domínio", { category: "inexistente" }],
    ])("rejeita %s por constraint da conta fixa", async (_label, overrides) => {
      const { error } = await clientA.from("fixed_bills").insert({
        ...BASE_FIXED_BILL,
        workspace_id: workspaceAId,
        ...overrides,
      });

      expect(error?.code).toBe("23514");
    });

    it.each([
      ["estimativa nula", { estimated_amount: null }],
      ["categoria nula", { category: null }],
    ])("rejeita %s por coluna obrigatória", async (_label, overrides) => {
      const { error } = await clientA.from("fixed_bills").insert({
        ...BASE_FIXED_BILL,
        workspace_id: workspaceAId,
        ...overrides,
      });

      expect(error?.code).toBe("23502");
    });

    it("rejeita dia de vencimento fracionário", async () => {
      const { error } = await clientA.from("fixed_bills").insert({
        ...BASE_FIXED_BILL,
        workspace_id: workspaceAId,
        due_day: 5.5,
      });

      expect(error).not.toBeNull();
    });

    it("preenche started_on com a data civil de São Paulo", async () => {
      const billId = await insertFixedBill(workspaceAId);
      const { data, error } = await clientA
        .from("fixed_bills")
        .select("started_on")
        .eq("id", billId)
        .single();

      expect(error).toBeNull();
      expect(data?.started_on).toBe(getTodayInSaoPaulo());
    });

    it("ignora started_on forjado no insert e deriva a data no banco", async () => {
      const { data, error } = await clientA
        .from("fixed_bills")
        .insert({
          ...BASE_FIXED_BILL,
          workspace_id: workspaceAId,
          started_on: "2000-01-01",
        })
        .select("started_on")
        .single();

      expect(error).toBeNull();
      expect(data?.started_on).toBe(getTodayInSaoPaulo());
    });

    it("impede mover conta fixa para outro workspace", async () => {
      const billId = await insertFixedBill(workspaceAId);
      const { error } = await clientA
        .from("fixed_bills")
        .update({ workspace_id: workspaceBId })
        .eq("id", billId);

      expect(error).not.toBeNull();

      const { data: preserved, error: preservedError } = await clientA
        .from("fixed_bills")
        .select("workspace_id")
        .eq("id", billId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved?.workspace_id).toBe(workspaceAId);
    });

    it.each([
      ["created_at", () => "2000-01-01T00:00:00.000Z"],
      ["started_on", () => "2000-01-01"],
    ])(
      "impede alterar o campo imutável %s da conta fixa",
      async (field, value) => {
        const billId = await insertFixedBill(workspaceAId);
        const { error } = await clientA
          .from("fixed_bills")
          .update({ [field]: value() })
          .eq("id", billId);

        expect(error?.code).toBe("23514");
      },
    );

    it("aceita pagamento vinculado a conta fixa do mesmo workspace", async () => {
      const billId = await insertFixedBill(workspaceAId);
      const paymentId = await insertPayment(billId);

      const { data, error } = await clientA
        .from("transactions")
        .select("kind, category, fixed_bill_id, goal_id")
        .eq("id", paymentId)
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        kind: "expense",
        category: "luz",
        fixed_bill_id: billId,
        goal_id: null,
      });
    });

    it("mantém despesa avulsa sem vínculo, sem exigir conta fixa", async () => {
      const paymentId = await insertPayment(null, { category: "alimentacao" });

      const { data, error } = await clientA
        .from("transactions")
        .select("fixed_bill_id")
        .eq("id", paymentId)
        .single();

      expect(error).toBeNull();
      expect(data?.fixed_bill_id).toBeNull();
    });

    it.each([
      ["receita", { kind: "income", category: "renda" }],
      ["aporte", { kind: "contribution", category: null }],
    ])("bloqueia fixed_bill_id em %s", async (_label, overrides) => {
      const billId = await insertFixedBill(workspaceAId);

      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_PAYMENT,
          workspace_id: workspaceAId,
          created_by: userAId,
          fixed_bill_id: billId,
          ...overrides,
        })
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();
    });

    it("bloqueia lançamento vinculado a meta e a conta fixa ao mesmo tempo", async () => {
      const billId = await insertFixedBill(workspaceAId);
      const { data: goal, error: goalError } = await clientA
        .from("goals")
        .insert({
          workspace_id: workspaceAId,
          name: "Meta para teste de exclusividade",
          target_amount: "1000.00",
        })
        .select("id")
        .single();
      if (goalError) throw goalError;

      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_PAYMENT,
          workspace_id: workspaceAId,
          created_by: userAId,
          fixed_bill_id: billId,
          goal_id: goal.id,
        })
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();
    });

    it("bloqueia insert de pagamento ligado a conta fixa de outro workspace", async () => {
      const foreignBillId = await insertFixedBillFor(clientB, workspaceBId);

      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_PAYMENT,
          workspace_id: workspaceAId,
          created_by: userAId,
          fixed_bill_id: foreignBillId,
        })
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();
    });

    it("bloqueia reatribuição por UPDATE para conta fixa de outro workspace", async () => {
      const billId = await insertFixedBill(workspaceAId);
      const foreignBillId = await insertFixedBillFor(clientB, workspaceBId);
      const paymentId = await insertPayment(billId);

      const { data, error } = await clientA
        .from("transactions")
        .update({ fixed_bill_id: foreignBillId })
        .eq("id", paymentId)
        .eq("workspace_id", workspaceAId)
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();

      const { data: preserved, error: preservedError } = await clientA
        .from("transactions")
        .select("fixed_bill_id")
        .eq("id", paymentId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved?.fixed_bill_id).toBe(billId);
    });

    it("permite reatribuir pagamento entre contas fixas do mesmo workspace", async () => {
      const sourceBillId = await insertFixedBill(workspaceAId, {
        name: "Conta de origem",
      });
      const destinationBillId = await insertFixedBill(workspaceAId, {
        name: "Conta de destino",
        category: "internet",
      });
      const paymentId = await insertPayment(sourceBillId);

      const { data, error } = await clientA
        .from("transactions")
        .update({
          fixed_bill_id: destinationBillId,
          category: "internet",
          amount: "120.00",
        })
        .eq("id", paymentId)
        .eq("workspace_id", workspaceAId)
        .select("fixed_bill_id, category, amount")
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        fixed_bill_id: destinationBillId,
        category: "internet",
        amount: 120,
      });
    });

    it("encerrar recorrência preserva o pagamento e aplica ON DELETE SET NULL", async () => {
      const billId = await insertFixedBill(workspaceAId, {
        name: "Conta removível",
      });
      const paymentId = await insertPayment(billId, { amount: "321.45" });

      const { data: deleted, error: deleteError } = await clientA
        .from("fixed_bills")
        .delete()
        .eq("id", billId)
        .eq("workspace_id", workspaceAId)
        .select("id")
        .single();
      expect(deleteError).toBeNull();
      expect(deleted?.id).toBe(billId);

      const { data: preserved, error: preservedError } = await clientA
        .from("transactions")
        .select("kind, amount, category, fixed_bill_id")
        .eq("id", paymentId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved).toEqual({
        kind: "expense",
        amount: 321.45,
        category: "luz",
        fixed_bill_id: null,
      });
    });

    it("permite reatribuir pagamento órfão e depois fazer hard-delete", async () => {
      const sourceBillId = await insertFixedBill(workspaceAId, {
        name: "Conta encerrada",
      });
      const destinationBillId = await insertFixedBill(workspaceAId, {
        name: "Conta ativa",
      });
      const paymentId = await insertPayment(sourceBillId);

      const { error: billDeleteError } = await clientA
        .from("fixed_bills")
        .delete()
        .eq("id", sourceBillId);
      if (billDeleteError) throw billDeleteError;

      const { data: reassigned, error: reassignError } = await clientA
        .from("transactions")
        .update({ fixed_bill_id: destinationBillId })
        .eq("id", paymentId)
        .eq("workspace_id", workspaceAId)
        .select("fixed_bill_id")
        .single();
      expect(reassignError).toBeNull();
      expect(reassigned?.fixed_bill_id).toBe(destinationBillId);

      const { data: deleted, error: deleteError } = await clientA
        .from("transactions")
        .delete()
        .eq("id", paymentId)
        .eq("workspace_id", workspaceAId)
        .select("id")
        .single();
      expect(deleteError).toBeNull();
      expect(deleted?.id).toBe(paymentId);

      const { data: residual, error: residualError } = await admin
        .from("transactions")
        .select("id")
        .eq("id", paymentId);
      expect(residualError).toBeNull();
      expect(residual).toEqual([]);
    });
  },
);

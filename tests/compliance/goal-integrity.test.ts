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

const BASE_GOAL = {
  name: "Reserva de emergência",
  target_amount: "5000.00",
  suggested_monthly: "500.00",
};

const BASE_CONTRIBUTION = {
  kind: "contribution",
  amount: "100.00",
  category: null,
  occurred_on: "2026-08-07",
};

describe.skipIf(!hasSupabaseTestEnv())(
  "Integridade e autorização de metas e aportes",
  () => {
    let admin: SupabaseClient;
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let userAId: string;
    let userBId: string;
    let workspaceAId: string;
    let workspaceBId: string;
    let goalAId: string;
    let foreignGoalId: string;

    beforeAll(async () => {
      admin = createTestAdminClient();
      const userA = await createConfirmedTestUser("goals-integrity-a");
      const userB = await createConfirmedTestUser("goals-integrity-b");
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
        { workspace_name: "Goal integrity A" },
      );
      if (workspaceAError) throw workspaceAError;
      workspaceAId = workspaceA as string;

      const { data: workspaceB, error: workspaceBError } = await clientB.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Goal integrity B" },
      );
      if (workspaceBError) throw workspaceBError;
      workspaceBId = workspaceB as string;

      goalAId = await insertGoal(workspaceAId, { name: "Meta principal" });
      const { data: foreignGoal, error: foreignGoalError } = await clientB
        .from("goals")
        .insert({
          ...BASE_GOAL,
          workspace_id: workspaceBId,
          name: "Meta de outro workspace",
        })
        .select("id")
        .single();
      if (foreignGoalError) throw foreignGoalError;
      foreignGoalId = foreignGoal.id as string;
    }, 30000);

    afterAll(async () => {
      await deleteTestAccount(userAId);
      await deleteTestAccount(userBId);
    }, 30000);

    async function insertGoal(
      workspaceId: string,
      overrides: Record<string, unknown> = {},
    ): Promise<string> {
      const { data, error } = await clientA
        .from("goals")
        .insert({
          ...BASE_GOAL,
          workspace_id: workspaceId,
          ...overrides,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id as string;
    }

    async function insertContribution(
      goalId: string,
      overrides: Record<string, unknown> = {},
    ): Promise<string> {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_CONTRIBUTION,
          workspace_id: workspaceAId,
          created_by: userAId,
          goal_id: goalId,
          ...overrides,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id as string;
    }

    it("permite CRUD legítimo de campos editáveis da meta", async () => {
      const goalId = await insertGoal(workspaceAId, { name: "Antes" });

      const { data, error } = await clientA
        .from("goals")
        .update({
          name: "Depois",
          target_amount: "4500.00",
          suggested_monthly: null,
        })
        .eq("id", goalId)
        .eq("workspace_id", workspaceAId)
        .select("name, target_amount, suggested_monthly")
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        name: "Depois",
        target_amount: 4500,
        suggested_monthly: null,
      });
    });

    it("impede outro workspace de ler, atualizar ou excluir a meta", async () => {
      const { data: readData, error: readError } = await clientB
        .from("goals")
        .select("id")
        .eq("id", goalAId);
      expect(readError).toBeNull();
      expect(readData).toEqual([]);

      const { data: updateData, error: updateError } = await clientB
        .from("goals")
        .update({ name: "Forjada" })
        .eq("id", goalAId)
        .select("id");
      expect(updateError).toBeNull();
      expect(updateData).toEqual([]);

      const { data: deleteData, error: deleteError } = await clientB
        .from("goals")
        .delete()
        .eq("id", goalAId)
        .select("id");
      expect(deleteError).toBeNull();
      expect(deleteData).toEqual([]);
    });

    it("impede inserir meta em workspace do qual o usuário não é membro", async () => {
      const { data, error } = await clientA
        .from("goals")
        .insert({ ...BASE_GOAL, workspace_id: workspaceBId })
        .select("id");

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it.each([
      ["nome vazio", { name: "" }],
      ["nome só com espaços", { name: "   " }],
      ["nome acima do limite", { name: "a".repeat(101) }],
      ["alvo zero", { target_amount: "0.00" }],
      ["alvo negativo", { target_amount: "-1.00" }],
      ["alvo NaN", { target_amount: "NaN" }],
      ["ritmo zero", { suggested_monthly: "0.00" }],
      ["ritmo negativo", { suggested_monthly: "-1.00" }],
      ["ritmo NaN", { suggested_monthly: "NaN" }],
    ])("rejeita %s por constraint da meta", async (_label, overrides) => {
      const { error } = await clientA.from("goals").insert({
        ...BASE_GOAL,
        workspace_id: workspaceAId,
        ...overrides,
      });

      expect(error?.code).toBe("23514");
    });

    it("preenche started_on com a data civil de São Paulo", async () => {
      const goalId = await insertGoal(workspaceAId);
      const { data, error } = await clientA
        .from("goals")
        .select("started_on")
        .eq("id", goalId)
        .single();

      expect(error).toBeNull();
      expect(data?.started_on).toBe(getTodayInSaoPaulo());
    });

    it("ignora started_on forjado no insert e deriva a data no banco", async () => {
      const { data, error } = await clientA
        .from("goals")
        .insert({
          ...BASE_GOAL,
          workspace_id: workspaceAId,
          started_on: "2000-01-01",
        })
        .select("started_on")
        .single();

      expect(error).toBeNull();
      expect(data?.started_on).toBe(getTodayInSaoPaulo());
    });

    it("impede mover meta para outro workspace", async () => {
      const goalId = await insertGoal(workspaceAId);
      const { error } = await clientA
        .from("goals")
        .update({ workspace_id: workspaceBId })
        .eq("id", goalId);

      expect(error).not.toBeNull();

      const { data: preserved, error: preservedError } = await clientA
        .from("goals")
        .select("workspace_id")
        .eq("id", goalId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved?.workspace_id).toBe(workspaceAId);
    });

    it.each([
      ["created_at", () => "2000-01-01T00:00:00.000Z"],
      ["started_on", () => "2000-01-01"],
    ])("impede alterar o campo imutável %s da meta", async (field, value) => {
      const goalId = await insertGoal(workspaceAId);
      const { error } = await clientA
        .from("goals")
        .update({ [field]: value() })
        .eq("id", goalId);

      expect(error?.code).toBe("23514");
    });

    it("bloqueia insert de contribution sem goal_id", async () => {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_CONTRIBUTION,
          workspace_id: workspaceAId,
          created_by: userAId,
          goal_id: null,
        })
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();
    });

    it("bloqueia insert de contribution ligado a meta de outro workspace", async () => {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          ...BASE_CONTRIBUTION,
          workspace_id: workspaceAId,
          created_by: userAId,
          goal_id: foreignGoalId,
        })
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();
    });

    it("bloqueia goal_id em despesa ou receita", async () => {
      const { data, error } = await clientA
        .from("transactions")
        .insert({
          workspace_id: workspaceAId,
          created_by: userAId,
          kind: "expense",
          amount: "10.00",
          category: "alimentacao",
          goal_id: goalAId,
          occurred_on: "2026-08-07",
        })
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();
    });

    it("aceita insert de contribution ligado a meta do mesmo workspace", async () => {
      const contributionId = await insertContribution(goalAId);

      const { data, error } = await clientA
        .from("transactions")
        .select("kind, category, goal_id")
        .eq("id", contributionId)
        .single();

      expect(error).toBeNull();
      expect(data).toEqual({
        kind: "contribution",
        category: null,
        goal_id: goalAId,
      });
    });

    it("bloqueia reatribuição por UPDATE para meta de outro workspace", async () => {
      const contributionId = await insertContribution(goalAId);

      const { data, error } = await clientA
        .from("transactions")
        .update({ goal_id: foreignGoalId })
        .eq("id", contributionId)
        .eq("workspace_id", workspaceAId)
        .select("id");

      expect(error?.code).toBe("23514");
      expect(data).toBeNull();

      const { data: preserved, error: preservedError } = await clientA
        .from("transactions")
        .select("goal_id")
        .eq("id", contributionId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved?.goal_id).toBe(goalAId);
    });

    it("excluir meta preserva o aporte e aplica ON DELETE SET NULL", async () => {
      const goalId = await insertGoal(workspaceAId, { name: "Meta removível" });
      const contributionId = await insertContribution(goalId, {
        amount: "321.45",
      });

      const { data: deleted, error: deleteError } = await clientA
        .from("goals")
        .delete()
        .eq("id", goalId)
        .eq("workspace_id", workspaceAId)
        .select("id")
        .single();
      expect(deleteError).toBeNull();
      expect(deleted?.id).toBe(goalId);

      const { data: preserved, error: preservedError } = await clientA
        .from("transactions")
        .select("kind, amount, goal_id")
        .eq("id", contributionId)
        .single();
      expect(preservedError).toBeNull();
      expect(preserved).toEqual({
        kind: "contribution",
        amount: 321.45,
        goal_id: null,
      });
    });

    it("permite reatribuir aporte órfão e depois fazer hard-delete", async () => {
      const sourceGoalId = await insertGoal(workspaceAId, {
        name: "Meta de origem",
      });
      const destinationGoalId = await insertGoal(workspaceAId, {
        name: "Meta de destino",
      });
      const contributionId = await insertContribution(sourceGoalId);

      const { error: goalDeleteError } = await clientA
        .from("goals")
        .delete()
        .eq("id", sourceGoalId);
      if (goalDeleteError) throw goalDeleteError;

      const { data: reassigned, error: reassignError } = await clientA
        .from("transactions")
        .update({ goal_id: destinationGoalId, amount: "200.00" })
        .eq("id", contributionId)
        .eq("workspace_id", workspaceAId)
        .select("goal_id, amount")
        .single();
      expect(reassignError).toBeNull();
      expect(reassigned).toEqual({
        goal_id: destinationGoalId,
        amount: 200,
      });

      const { data: deleted, error: deleteError } = await clientA
        .from("transactions")
        .delete()
        .eq("id", contributionId)
        .eq("workspace_id", workspaceAId)
        .select("id")
        .single();
      expect(deleteError).toBeNull();
      expect(deleted?.id).toBe(contributionId);

      const { data: residual, error: residualError } = await admin
        .from("transactions")
        .select("id")
        .eq("id", contributionId);
      expect(residualError).toBeNull();
      expect(residual).toEqual([]);
    });
  },
);

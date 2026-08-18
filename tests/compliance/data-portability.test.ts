import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportUserData } from "@/lib/portability/export";
import {
  createAuthenticatedTestClient,
  createConfirmedTestUser,
  deleteTestAccount,
  hasSupabaseTestEnv,
  retryAfterJwtClockSkew,
} from "./support";

config({ path: ".env.local", quiet: true });

describe.skipIf(!hasSupabaseTestEnv())("Portabilidade de dados", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let userAId: string;
  let userBId: string;
  let workspaceAId: string;
  let workspaceBId: string;
  let deletedTransactionId: string;
  let orphanContributionId: string;
  let orphanBillPaymentId: string;

  beforeAll(async () => {
    const userA = await createConfirmedTestUser("portability-a");
    const userB = await createConfirmedTestUser("portability-b");
    userAId = userA.id;
    userBId = userB.id;
    [clientA, clientB] = await Promise.all([
      createAuthenticatedTestClient(userA),
      createAuthenticatedTestClient(userB),
    ]);

    const [workspaceA, workspaceB] = await Promise.all([
      retryAfterJwtClockSkew(() =>
        clientA.rpc("create_workspace_with_owner", {
          workspace_name: "Portability workspace A",
        }),
      ),
      retryAfterJwtClockSkew(() =>
        clientB.rpc("create_workspace_with_owner", {
          workspace_name: "Portability workspace B",
        }),
      ),
    ]);
    if (workspaceA.error) throw workspaceA.error;
    if (workspaceB.error) throw workspaceB.error;
    workspaceAId = workspaceA.data as string;
    workspaceBId = workspaceB.data as string;

    const { data: goalA, error: goalAError } = await clientA
      .from("goals")
      .insert({
        workspace_id: workspaceAId,
        name: "Reserva A",
        target_amount: "1000.00",
        suggested_monthly: "100.00",
      })
      .select("id")
      .single();
    if (goalAError) throw goalAError;

    const { error: billAError } = await clientA.from("fixed_bills").insert({
      workspace_id: workspaceAId,
      name: "Luz A",
      due_day: 10,
      category: "luz",
      estimated_amount: "200.00",
    });
    if (billAError) throw billAError;

    const { error: transactionAError } = await clientA
      .from("transactions")
      .insert({
        workspace_id: workspaceAId,
        created_by: userAId,
        kind: "contribution",
        amount: "75.00",
        category: null,
        goal_id: goalA.id,
        occurred_on: "2026-08-01",
      });
    if (transactionAError) throw transactionAError;

    const { data: deletedGoal, error: deletedGoalError } = await clientA
      .from("goals")
      .insert({
        workspace_id: workspaceAId,
        name: "Meta removida A",
        target_amount: "300.00",
        suggested_monthly: "30.00",
      })
      .select("id")
      .single();
    if (deletedGoalError) throw deletedGoalError;

    const { data: orphanContribution, error: orphanContributionError } =
      await clientA
        .from("transactions")
        .insert({
          workspace_id: workspaceAId,
          created_by: userAId,
          kind: "contribution",
          amount: "25.00",
          category: null,
          goal_id: deletedGoal.id,
          occurred_on: "2026-08-03",
        })
        .select("id")
        .single();
    if (orphanContributionError) throw orphanContributionError;
    orphanContributionId = orphanContribution.id;

    const { error: deleteGoalError } = await clientA
      .from("goals")
      .delete()
      .eq("id", deletedGoal.id)
      .eq("workspace_id", workspaceAId);
    if (deleteGoalError) throw deleteGoalError;

    const { data: deletedFixedBill, error: deletedFixedBillError } = await clientA
      .from("fixed_bills")
      .insert({
        workspace_id: workspaceAId,
        name: "Conta removida A",
        due_day: 15,
        category: "internet",
        estimated_amount: "150.00",
      })
      .select("id")
      .single();
    if (deletedFixedBillError) throw deletedFixedBillError;

    const { data: orphanBillPayment, error: orphanBillPaymentError } =
      await clientA
        .from("transactions")
        .insert({
          workspace_id: workspaceAId,
          created_by: userAId,
          kind: "expense",
          amount: "150.00",
          category: "internet",
          fixed_bill_id: deletedFixedBill.id,
          occurred_on: "2026-08-04",
        })
        .select("id")
        .single();
    if (orphanBillPaymentError) throw orphanBillPaymentError;
    orphanBillPaymentId = orphanBillPayment.id;

    const { error: deleteFixedBillError } = await clientA
      .from("fixed_bills")
      .delete()
      .eq("id", deletedFixedBill.id)
      .eq("workspace_id", workspaceAId);
    if (deleteFixedBillError) throw deleteFixedBillError;

    const { data: deletedTransaction, error: deletedTransactionError } =
      await clientA
        .from("transactions")
        .insert({
          workspace_id: workspaceAId,
          created_by: userAId,
          kind: "expense",
          amount: "10.00",
          category: "alimentacao",
          occurred_on: "2026-08-02",
        })
        .select("id")
        .single();
    if (deletedTransactionError) throw deletedTransactionError;
    deletedTransactionId = deletedTransaction.id;

    const { error: deleteError } = await clientA
      .from("transactions")
      .delete()
      .eq("id", deletedTransactionId)
      .eq("workspace_id", workspaceAId);
    if (deleteError) throw deleteError;

    const { error: transactionBError } = await clientB.from("transactions").insert({
      workspace_id: workspaceBId,
      created_by: userBId,
      kind: "expense",
      amount: "999.99",
      category: "alimentacao",
      occurred_on: "2026-08-01",
    });
    if (transactionBError) throw transactionBError;
  }, 20000);

  afterAll(async () => {
    if (userAId) await deleteTestAccount(userAId);
    if (userBId) await deleteTestAccount(userBId);
  }, 20000);

  it("exporta somente as linhas visíveis por RLS e exclui registros removidos", async () => {
    const result = await exportUserData(clientA, userAId);

    expect(result.error).toBeNull();
    if (!result.data) throw new Error("expected export data");

    expect(result.data.profile?.id).toBe(userAId);
    expect(result.data.workspaces.map((workspace) => workspace.id)).toEqual([
      workspaceAId,
    ]);
    expect(
      result.data.workspace_members.every(
        (member) => member.workspace_id === workspaceAId,
      ),
    ).toBe(true);
    expect(
      result.data.transactions.every(
        (transaction) => transaction.workspace_id === workspaceAId,
      ),
    ).toBe(true);
    expect(result.data.transactions.map((transaction) => transaction.id)).not.toContain(
      deletedTransactionId,
    );
    expect(result.data.transactions[0]?.amount).toBe("75.00");
    expect(result.data.goals[0]?.target_amount).toBe("1000.00");
    expect(result.data.goals[0]?.suggested_monthly).toBe("100.00");
    expect(result.data.fixed_bills[0]?.estimated_amount).toBe("200.00");
    expect(result.data.goals.map((goal) => goal.name)).not.toContain(
      "Meta removida A",
    );
    expect(result.data.fixed_bills.map((bill) => bill.name)).not.toContain(
      "Conta removida A",
    );
    expect(
      result.data.transactions.find(
        (transaction) => transaction.id === orphanContributionId,
      )?.goal_id,
    ).toBeNull();
    expect(
      result.data.transactions.find(
        (transaction) => transaction.id === orphanBillPaymentId,
      )?.fixed_bill_id,
    ).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain("Meta removida A");
    expect(JSON.stringify(result.data)).not.toContain("Conta removida A");
    expect(JSON.stringify(result.data)).not.toContain(workspaceBId);
    expect(JSON.stringify(result.data)).not.toContain(userBId);
  });

  it("repete o isolamento ao exportar sob a sessão do segundo usuário", async () => {
    const result = await exportUserData(clientB, userBId);

    expect(result.error).toBeNull();
    if (!result.data) throw new Error("expected export data");

    expect(result.data.profile?.id).toBe(userBId);
    expect(result.data.workspaces.map((workspace) => workspace.id)).toEqual([
      workspaceBId,
    ]);
    expect(
      result.data.transactions.every(
        (transaction) => transaction.workspace_id === workspaceBId,
      ),
    ).toBe(true);
    expect(JSON.stringify(result.data)).not.toContain(workspaceAId);
    expect(JSON.stringify(result.data)).not.toContain(userAId);
  });
});

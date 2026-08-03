import { config } from "dotenv";
import { describe, it, expect } from "vitest";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

// Roda só quando as credenciais Supabase estão em .env.local. No CI, sem os
// secrets configurados, os testes são pulados em vez de falhar.
describe.skipIf(!hasSupabaseTestEnv())("Apagamento em cascata", () => {
  it(
    "apagar conta remove participações e workspaces órfãos, e o cascade de workspaces limpa transações, contas fixas e metas",
    async () => {
      const admin = createTestAdminClient();
      const user = await createConfirmedTestUser("cascade");

      const client = createAnonTestClient();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (signInError) throw signInError;

      const { data: workspaceId, error: workspaceError } = await client.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Cascade test workspace" },
      );
      if (workspaceError) throw workspaceError;

      const { error: txError } = await client.from("transactions").insert({
        workspace_id: workspaceId,
        created_by: user.id,
        kind: "expense",
        amount: "5.00",
        occurred_on: "2026-01-01",
      });
      if (txError) throw txError;

      const { error: billError } = await client.from("fixed_bills").insert({
        workspace_id: workspaceId,
        name: "Aluguel",
        due_day: "5",
      });
      if (billError) throw billError;

      const { error: goalError } = await client.from("goals").insert({
        workspace_id: workspaceId,
        name: "Reserva de emergência",
        target_amount: "1000.00",
      });
      if (goalError) throw goalError;

      // Único membro do workspace: apagar a conta deixa o workspace órfão,
      // que a própria handle_account_deletion remove, cascateando para
      // transactions/fixed_bills/goals.
      await deleteTestAccount(user.id);

      const { data: membership } = await admin
        .from("workspace_members")
        .select("*")
        .eq("user_id", user.id);
      expect(membership).toEqual([]);

      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("id", user.id);
      expect(profile).toEqual([]);

      const { data: workspace } = await admin
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId);
      expect(workspace).toEqual([]);

      const { data: transactions } = await admin
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId);
      expect(transactions).toEqual([]);

      const { data: fixedBills } = await admin
        .from("fixed_bills")
        .select("*")
        .eq("workspace_id", workspaceId);
      expect(fixedBills).toEqual([]);

      const { data: goals } = await admin
        .from("goals")
        .select("*")
        .eq("workspace_id", workspaceId);
      expect(goals).toEqual([]);
    },
    20000,
  );

  it(
    "apagar conta de um membro que não é o último preserva os dados do workspace",
    async () => {
      const admin = createTestAdminClient();
      const owner = await createConfirmedTestUser("cascade-owner");
      const member = await createConfirmedTestUser("cascade-member");

      const ownerClient = createAnonTestClient();
      const { error: signInOwnerError } = await ownerClient.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      });
      if (signInOwnerError) throw signInOwnerError;

      const { data: workspaceId, error: workspaceError } = await ownerClient.rpc(
        "create_workspace_with_owner",
        { workspace_name: "Shared workspace" },
      );
      if (workspaceError) throw workspaceError;

      // Adiciona o segundo membro via service-role (não há fluxo de convite no MVP).
      const { error: memberInsertError } = await admin.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: member.id,
        role: "member",
      });
      if (memberInsertError) throw memberInsertError;

      const { error: txError } = await admin.from("transactions").insert({
        workspace_id: workspaceId,
        created_by: member.id,
        kind: "expense",
        amount: "20.00",
        occurred_on: "2026-01-01",
      });
      if (txError) throw txError;

      await deleteTestAccount(member.id);

      const { data: workspace } = await admin
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId);
      expect(workspace).toHaveLength(1); // dono continua existindo

      const { data: transactions } = await admin
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId);
      expect(transactions).toHaveLength(1); // dado do workspace preservado

      await deleteTestAccount(owner.id);
    },
    20000,
  );
});

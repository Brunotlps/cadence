import { config } from "dotenv";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

describe.skipIf(!hasSupabaseTestEnv())("Singleton de workspace por usuário", () => {
  const createdUserIds = new Set<string>();
  let singletonMigrationApplied = false;

  beforeAll(async () => {
    const probeUser = await createConfirmedTestUser("workspace-singleton-probe");
    const admin = createTestAdminClient();

    try {
      const { data: workspaceA, error: workspaceAError } = await admin
        .from("workspaces")
        .insert({ name: "Workspace singleton probe A" })
        .select("id")
        .single();
      if (workspaceAError) throw workspaceAError;

      const { data: workspaceB, error: workspaceBError } = await admin
        .from("workspaces")
        .insert({ name: "Workspace singleton probe B" })
        .select("id")
        .single();
      if (workspaceBError) throw workspaceBError;

      const { error: firstInsertError } = await admin
        .from("workspace_members")
        .insert({
          workspace_id: workspaceA.id,
          user_id: probeUser.id,
          role: "owner",
        });
      if (firstInsertError) throw firstInsertError;

      const { error: secondInsertError } = await admin
        .from("workspace_members")
        .insert({
          workspace_id: workspaceB.id,
          user_id: probeUser.id,
          role: "member",
        });

      singletonMigrationApplied =
        secondInsertError?.message.includes(
          "workspace_members_user_id_unique",
        ) === true;

      if (secondInsertError && !singletonMigrationApplied) {
        throw secondInsertError;
      }
    } finally {
      await deleteTestAccount(probeUser.id);
    }
  });

  afterEach(async () => {
    const userIds = Array.from(createdUserIds);
    createdUserIds.clear();

    for (const userId of userIds) {
      await deleteTestAccount(userId);
    }
  }, 20000);

  it("permite a primeira criação via RPC e recusa a segunda com already_has_workspace", async () => {
    if (!singletonMigrationApplied) return;

    const user = await createConfirmedTestUser("workspace-singleton-rpc");
    createdUserIds.add(user.id);

    const client = createAnonTestClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signInError) throw signInError;

    const { data: firstWorkspaceId, error: firstError } = await client.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Primeiro espaço" },
    );
    expect(firstError).toBeNull();
    expect(typeof firstWorkspaceId).toBe("string");

    const { data: secondWorkspaceId, error: secondError } = await client.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Segundo espaço" },
    );
    expect(secondWorkspaceId).toBeNull();
    expect(secondError?.message).toContain("already_has_workspace");

    const admin = createTestAdminClient();
    const { data: memberships, error: membershipError } = await admin
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id);
    if (membershipError) throw membershipError;
    expect(memberships).toHaveLength(1);
  });

  it("recusa criação via RPC quando o usuário já entrou como membro de outro workspace", async () => {
    if (!singletonMigrationApplied) return;

    const owner = await createConfirmedTestUser("workspace-singleton-owner");
    const member = await createConfirmedTestUser("workspace-singleton-member");
    createdUserIds.add(owner.id);
    createdUserIds.add(member.id);

    const ownerClient = createAnonTestClient();
    const { error: ownerSignInError } = await ownerClient.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    if (ownerSignInError) throw ownerSignInError;

    const { data: workspaceId, error: workspaceError } = await ownerClient.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Workspace compartilhado" },
    );
    if (workspaceError) throw workspaceError;

    const admin = createTestAdminClient();
    const { error: insertError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: member.id,
      role: "member",
    });
    if (insertError) throw insertError;

    const memberClient = createAnonTestClient();
    const { error: memberSignInError } = await memberClient.auth.signInWithPassword({
      email: member.email,
      password: member.password,
    });
    if (memberSignInError) throw memberSignInError;

    const { data, error } = await memberClient.rpc("create_workspace_with_owner", {
      workspace_name: "Workspace próprio indevido",
    });
    expect(data).toBeNull();
    expect(error?.message).toContain("already_has_workspace");
  });

  it("a constraint direta impede duas memberships para o mesmo user_id", async () => {
    if (!singletonMigrationApplied) return;

    const user = await createConfirmedTestUser("workspace-singleton-constraint");
    createdUserIds.add(user.id);

    const admin = createTestAdminClient();
    const { data: workspaceA, error: workspaceAError } = await admin
      .from("workspaces")
      .insert({ name: "Workspace A" })
      .select("id")
      .single();
    if (workspaceAError) throw workspaceAError;

    const { data: workspaceB, error: workspaceBError } = await admin
      .from("workspaces")
      .insert({ name: "Workspace B" })
      .select("id")
      .single();
    if (workspaceBError) throw workspaceBError;

    const { error: firstInsertError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceA.id,
      user_id: user.id,
      role: "owner",
    });
    expect(firstInsertError).toBeNull();

    const { error: secondInsertError } = await admin.from("workspace_members").insert({
      workspace_id: workspaceB.id,
      user_id: user.id,
      role: "member",
    });
    expect(secondInsertError?.code).toBe("23505");
    expect(secondInsertError?.message).toContain(
      "workspace_members_user_id_unique",
    );
  });

  it("chamadas concorrentes da RPC não criam duas memberships", async () => {
    if (!singletonMigrationApplied) return;

    const user = await createConfirmedTestUser("workspace-singleton-concurrency");
    createdUserIds.add(user.id);

    const clientA = createAnonTestClient();
    const clientB = createAnonTestClient();

    const { error: signInAError } = await clientA.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signInAError) throw signInAError;

    const { error: signInBError } = await clientB.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signInBError) throw signInBError;

    const attempts = await Promise.all([
      clientA.rpc("create_workspace_with_owner", {
        workspace_name: "Concorrente A",
      }),
      clientB.rpc("create_workspace_with_owner", {
        workspace_name: "Concorrente B",
      }),
    ]);

    const successes = attempts.filter(({ error }) => error === null);
    const alreadyHasWorkspaceErrors = attempts.filter(({ error }) =>
      error?.message.includes("already_has_workspace"),
    );

    expect(successes).toHaveLength(1);
    expect(alreadyHasWorkspaceErrors).toHaveLength(1);

    const admin = createTestAdminClient();
    const { data: memberships, error: membershipError } = await admin
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id);
    if (membershipError) throw membershipError;
    expect(memberships).toHaveLength(1);
  });
});

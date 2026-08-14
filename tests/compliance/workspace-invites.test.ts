import { config } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAnonTestClient,
  createConfirmedTestUser,
  createTestAdminClient,
  deleteTestAccount,
  hasSupabaseTestEnv,
} from "./support";

config({ path: ".env.local", quiet: true });

describe.skipIf(!hasSupabaseTestEnv())("Grants de convite de workspace", () => {
  let createdUserId: string | undefined;

  afterAll(async () => {
    if (createdUserId) await deleteTestAccount(createdUserId);
  });

  it("anon não consegue chamar create_workspace_invite", async () => {
    const anon = createAnonTestClient();
    const { data, error } = await anon.rpc("create_workspace_invite", {
      target_workspace_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("anon não consegue chamar redeem_workspace_invite", async () => {
    const anon = createAnonTestClient();
    const { data, error } = await anon.rpc("redeem_workspace_invite", {
      invite_token: "00000000-0000-0000-0000-000000000000",
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("quem não é membro do workspace não consegue criar convite para ele", async () => {
    const owner = await createConfirmedTestUser("invite-grant-owner");
    const outsider = await createConfirmedTestUser("invite-grant-outsider");
    createdUserId = owner.id;

    const ownerClient = createAnonTestClient();
    const { error: signInOwnerError } = await ownerClient.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    if (signInOwnerError) throw signInOwnerError;
    const { data: workspaceId, error: workspaceError } = await ownerClient.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Grant test workspace" },
    );
    if (workspaceError) throw workspaceError;

    const outsiderClient = createAnonTestClient();
    const { error: signInOutsiderError } = await outsiderClient.auth.signInWithPassword({
      email: outsider.email,
      password: outsider.password,
    });
    if (signInOutsiderError) throw signInOutsiderError;

    const { data, error } = await outsiderClient.rpc("create_workspace_invite", {
      target_workspace_id: workspaceId,
    });

    expect(data).toBeNull();
    expect(error).toBeTruthy();

    await deleteTestAccount(outsider.id);
  });
});

describe.skipIf(!hasSupabaseTestEnv())("Isolamento e ciclo de vida do convite", () => {
  let ownerClient: SupabaseClient;
  let memberOutsideClient: SupabaseClient;
  let ownerId: string;
  let outsiderId: string;
  let workspaceId: string;

  beforeAll(async () => {
    const owner = await createConfirmedTestUser("invite-owner");
    const outsider = await createConfirmedTestUser("invite-outsider");
    ownerId = owner.id;
    outsiderId = outsider.id;

    ownerClient = createAnonTestClient();
    memberOutsideClient = createAnonTestClient();

    const { error: signInOwnerError } = await ownerClient.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    if (signInOwnerError) throw signInOwnerError;

    const { error: signInOutsiderError } = await memberOutsideClient.auth.signInWithPassword({
      email: outsider.email,
      password: outsider.password,
    });
    if (signInOutsiderError) throw signInOutsiderError;

    const { data: id, error: workspaceError } = await ownerClient.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Invite lifecycle workspace" },
    );
    if (workspaceError) throw workspaceError;
    workspaceId = id as string;
  }, 20000);

  afterAll(async () => {
    await deleteTestAccount(ownerId);
    await deleteTestAccount(outsiderId);
  }, 20000);

  it("dono cria um convite para o próprio workspace", async () => {
    const { data, error } = await ownerClient.rpc("create_workspace_invite", {
      target_workspace_id: workspaceId,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].token).toBeTruthy();
    expect(data[0].expires_at).toBeTruthy();
  });

  it("quem não é membro não vê os convites do workspace via select direto", async () => {
    const { data, error } = await memberOutsideClient
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("membro vê os convites do próprio workspace", async () => {
    const { data, error } = await ownerClient
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it(
    "resgate válido adiciona o membro e marca o convite como usado; resgatar de novo falha",
    async () => {
      const invitee = await createConfirmedTestUser("invite-redeem");
      const inviteeClient = createAnonTestClient();
      const { error: signInError } = await inviteeClient.auth.signInWithPassword({
        email: invitee.email,
        password: invitee.password,
      });
      if (signInError) throw signInError;

      const { data: created, error: createError } = await ownerClient.rpc(
        "create_workspace_invite",
        { target_workspace_id: workspaceId },
      );
      if (createError) throw createError;
      const token = created[0].token as string;

      const { data: redeemedWorkspaceId, error: redeemError } = await inviteeClient.rpc(
        "redeem_workspace_invite",
        { invite_token: token },
      );
      expect(redeemError).toBeNull();
      expect(redeemedWorkspaceId).toBe(workspaceId);

      const admin = createTestAdminClient();
      const { data: membership } = await admin
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", invitee.id);
      expect(membership).toHaveLength(1);
      expect(membership![0].role).toBe("member");

      // Usar de novo (mesmo token, mesma pessoa) falha: já foi consumido.
      const { data: secondAttempt, error: secondError } = await inviteeClient.rpc(
        "redeem_workspace_invite",
        { invite_token: token },
      );
      expect(secondAttempt).toBeNull();
      expect(secondError?.message).toContain("already_has_workspace");

      await deleteTestAccount(invitee.id);
    },
    20000,
  );

  it("token inexistente ou já usado por outra pessoa é recusado", async () => {
    const invitee = await createConfirmedTestUser("invite-invalid");
    const inviteeClient = createAnonTestClient();
    const { error: signInError } = await inviteeClient.auth.signInWithPassword({
      email: invitee.email,
      password: invitee.password,
    });
    if (signInError) throw signInError;

    const { data, error } = await inviteeClient.rpc("redeem_workspace_invite", {
      invite_token: "00000000-0000-0000-0000-000000000000",
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("invalid_or_expired");

    await deleteTestAccount(invitee.id);
  });

  it("token expirado é recusado mesmo sem ter sido usado", async () => {
    const admin = createTestAdminClient();
    const invitee = await createConfirmedTestUser("invite-expired");
    const inviteeClient = createAnonTestClient();
    const { error: signInError } = await inviteeClient.auth.signInWithPassword({
      email: invitee.email,
      password: invitee.password,
    });
    if (signInError) throw signInError;

    const { data: created, error: createError } = await ownerClient.rpc(
      "create_workspace_invite",
      { target_workspace_id: workspaceId },
    );
    if (createError) throw createError;
    const token = created[0].token as string;

    // Só o service-role consegue alterar expires_at diretamente — nenhum
    // fluxo da aplicação faz isso, é só pra simular um convite vencido sem
    // esperar 7 dias de verdade.
    const { error: updateError } = await admin
      .from("workspace_invites")
      .update({ expires_at: "2020-01-01T00:00:00.000Z" })
      .eq("token", token);
    if (updateError) throw updateError;

    const { data, error } = await inviteeClient.rpc("redeem_workspace_invite", {
      invite_token: token,
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("invalid_or_expired");

    await deleteTestAccount(invitee.id);
  });

  it("quem já tem workspace não consegue resgatar outro convite", async () => {
    const already = await createConfirmedTestUser("invite-already");
    const alreadyClient = createAnonTestClient();
    const { error: signInError } = await alreadyClient.auth.signInWithPassword({
      email: already.email,
      password: already.password,
    });
    if (signInError) throw signInError;

    const { error: ownWorkspaceError } = await alreadyClient.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Já tenho meu espaço" },
    );
    if (ownWorkspaceError) throw ownWorkspaceError;

    const { data: created, error: createError } = await ownerClient.rpc(
      "create_workspace_invite",
      { target_workspace_id: workspaceId },
    );
    if (createError) throw createError;
    const token = created[0].token as string;

    const { data, error } = await alreadyClient.rpc("redeem_workspace_invite", {
      invite_token: token,
    });

    expect(data).toBeNull();
    expect(error?.message).toContain("already_has_workspace");

    const admin = createTestAdminClient();
    const { data: membership } = await admin
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", already.id);
    expect(membership).toEqual([]);

    await deleteTestAccount(already.id);
  });

  it("apagar o workspace apaga seus convites em cascata", async () => {
    const admin = createTestAdminClient();
    const cascadeOwner = await createConfirmedTestUser("invite-cascade-owner");
    const cascadeOwnerClient = createAnonTestClient();
    const { error: signInError } = await cascadeOwnerClient.auth.signInWithPassword({
      email: cascadeOwner.email,
      password: cascadeOwner.password,
    });
    if (signInError) throw signInError;

    const { data: cascadeWorkspaceId, error: workspaceError } = await cascadeOwnerClient.rpc(
      "create_workspace_with_owner",
      { workspace_name: "Cascade invite workspace" },
    );
    if (workspaceError) throw workspaceError;

    const { data: created, error: createError } = await cascadeOwnerClient.rpc(
      "create_workspace_invite",
      { target_workspace_id: cascadeWorkspaceId },
    );
    if (createError) throw createError;
    expect(created).toHaveLength(1);

    // Único membro: apagar a conta do dono deixa o workspace órfão, e
    // handle_account_deletion o remove — o cascade de workspace_invites é o
    // que este teste verifica.
    await deleteTestAccount(cascadeOwner.id);

    const { data: invites } = await admin
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", cascadeWorkspaceId);
    expect(invites).toEqual([]);
  });
});

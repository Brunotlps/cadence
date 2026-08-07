import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteContribution: vi.fn(),
  deleteGoal: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getGoalById: vi.fn(),
  getUser: vi.fn(),
  insertContribution: vi.fn(),
  insertGoal: vi.fn(),
  revalidatePath: vi.fn(),
  updateContribution: vi.fn(),
  updateGoal: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/goals/repository", () => ({
  deleteContribution: mocks.deleteContribution,
  deleteGoal: mocks.deleteGoal,
  getGoalById: mocks.getGoalById,
  insertContribution: mocks.insertContribution,
  insertGoal: mocks.insertGoal,
  updateContribution: mocks.updateContribution,
  updateGoal: mocks.updateGoal,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createContributionAction,
  createGoalAction,
  deleteContributionAction,
  deleteGoalAction,
  updateContributionAction,
  updateGoalAction,
  type GoalActionState,
} from "@/lib/actions/goals";

const GOAL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_GOAL_ID = "22222222-2222-4222-8222-222222222222";
const CONTRIBUTION_ID = "33333333-3333-4333-8333-333333333333";

const initialState: GoalActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

function goalForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    name: "Reserva de emergência",
    targetAmount: "50.000,00",
    suggestedMonthly: "1.000,00",
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }
  return formData;
}

function contributionForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    amount: "750,00",
    occurredOn: "2026-08-07",
    goalId: GOAL_ID,
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }
  return formData;
}

describe("Server Actions de metas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = {
      auth: { getUser: mocks.getUser },
    } as unknown as SupabaseClient;

    mocks.createClient.mockResolvedValue(client);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "server-user-id" } },
      error: null,
    });
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "server-workspace-id", name: "Casa" },
      error: null,
    });
    mocks.getGoalById.mockResolvedValue({
      data: { id: GOAL_ID, workspaceId: "server-workspace-id" },
      error: null,
    });
    mocks.insertGoal.mockResolvedValue({
      data: { id: GOAL_ID },
      error: null,
    });
    mocks.updateGoal.mockResolvedValue({
      data: { id: GOAL_ID },
      error: null,
    });
    mocks.deleteGoal.mockResolvedValue({ data: true, error: null });
    mocks.insertContribution.mockResolvedValue({
      data: { id: CONTRIBUTION_ID },
      error: null,
    });
    mocks.updateContribution.mockResolvedValue({
      data: { id: CONTRIBUTION_ID },
      error: null,
    });
    mocks.deleteContribution.mockResolvedValue({ data: true, error: null });
  });

  it("cria meta no workspace resolvido no servidor", async () => {
    const formData = goalForm();
    formData.set("workspaceId", "foreign-workspace-id");

    const result = await createGoalAction(initialState, formData);

    expect(mocks.insertGoal).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      goal: {
        name: "Reserva de emergência",
        targetAmount: "50000.00",
        targetAmountCents: 5_000_000,
        suggestedMonthly: "1000.00",
        suggestedMonthlyCents: 100_000,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/goals");
    expect(result).toEqual({ error: null, fieldErrors: {}, success: true });
  });

  it("filtra update e delete de meta por id vinculado e workspace", async () => {
    await updateGoalAction(GOAL_ID, initialState, goalForm());
    await deleteGoalAction(GOAL_ID, initialState, new FormData());

    expect(mocks.updateGoal).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      goalId: GOAL_ID,
      goal: expect.objectContaining({ targetAmount: "50000.00" }),
    });
    expect(mocks.deleteGoal).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      goalId: GOAL_ID,
    });
  });

  it("torna meta ausente e invisível indistinguíveis", async () => {
    mocks.updateGoal
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await updateGoalAction(
      "44444444-4444-4444-8444-444444444444",
      initialState,
      goalForm(),
    );
    const invisible = await updateGoalAction(
      "55555555-5555-4555-8555-555555555555",
      initialState,
      goalForm(),
    );

    expect(missing).toEqual(invisible);
    expect(missing.success).toBe(false);
    expect(missing.error).toBe("Não foi possível salvar a meta.");
  });

  it("cria aporte na meta vinculada sem confiar em kind, autoria ou workspace do formulário", async () => {
    const formData = contributionForm({ goalId: OTHER_GOAL_ID });
    formData.set("kind", "income");
    formData.set("createdBy", "attacker-id");
    formData.set("workspaceId", "foreign-workspace-id");

    const result = await createContributionAction(
      GOAL_ID,
      initialState,
      formData,
    );

    expect(mocks.getGoalById).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      goalId: GOAL_ID,
    });
    expect(mocks.insertContribution).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      createdBy: "server-user-id",
      contribution: {
        amount: "750.00",
        amountCents: 75_000,
        occurredOn: "2026-08-07",
        goalId: GOAL_ID,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/goals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result.success).toBe(true);
  });

  it("reatribui aporte somente depois de validar a meta de destino no workspace", async () => {
    mocks.getGoalById.mockResolvedValueOnce({
      data: { id: OTHER_GOAL_ID, workspaceId: "server-workspace-id" },
      error: null,
    });

    const result = await updateContributionAction(
      CONTRIBUTION_ID,
      initialState,
      contributionForm({ goalId: OTHER_GOAL_ID }),
    );

    expect(mocks.getGoalById).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      goalId: OTHER_GOAL_ID,
    });
    expect(mocks.updateContribution).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      transactionId: CONTRIBUTION_ID,
      contribution: {
        amount: "750.00",
        amountCents: 75_000,
        occurredOn: "2026-08-07",
        goalId: OTHER_GOAL_ID,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/goals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result.success).toBe(true);
  });

  it("bloqueia na Server Action a reatribuição para meta de outro workspace", async () => {
    mocks.getGoalById.mockResolvedValue({ data: null, error: null });

    const result = await updateContributionAction(
      CONTRIBUTION_ID,
      initialState,
      contributionForm({ goalId: OTHER_GOAL_ID }),
    );

    expect(result).toEqual({
      error: "Não foi possível salvar o aporte.",
      fieldErrors: {},
      success: false,
    });
    expect(mocks.getGoalById).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      goalId: OTHER_GOAL_ID,
    });
    expect(mocks.updateContribution).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("faz hard-delete do aporte por id e workspace e revalida metas e Dashboard", async () => {
    const formData = new FormData();
    formData.set("workspaceId", "foreign-workspace-id");

    const result = await deleteContributionAction(
      CONTRIBUTION_ID,
      initialState,
      formData,
    );

    expect(mocks.deleteContribution).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "server-workspace-id",
      transactionId: CONTRIBUTION_ID,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/goals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result.success).toBe(true);
  });

  it("retorna o mesmo erro para aporte ausente, invisível ou rejeitado", async () => {
    mocks.deleteContribution
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await deleteContributionAction(
      "66666666-6666-4666-8666-666666666666",
      initialState,
      new FormData(),
    );
    const invisible = await deleteContributionAction(
      "77777777-7777-4777-8777-777777777777",
      initialState,
      new FormData(),
    );

    expect(missing).toEqual(invisible);
    expect(missing.error).toBe("Não foi possível excluir o aporte.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

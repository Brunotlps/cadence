import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getContributionById: vi.fn(),
  getCurrentWorkspace: vi.fn(),
  getGoalById: vi.fn(),
  listGoals: vi.fn(),
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/goals/repository", () => ({
  getContributionById: mocks.getContributionById,
  getGoalById: mocks.getGoalById,
  listGoals: mocks.listGoals,
}));

import {
  loadContributionForEdit,
  loadGoalForEdit,
} from "@/lib/goals/load-edit";

const client = {} as SupabaseClient;
const goal = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reserva",
  targetAmount: "5000.00",
  suggestedMonthly: "500.00",
  startedOn: "2026-08-07",
  createdAt: "2026-08-07T12:00:00.000Z",
};
const contribution = {
  id: "22222222-2222-4222-8222-222222222222",
  goalId: null,
  createdBy: "user-id",
  amount: "250.00",
  occurredOn: "2026-08-07",
  createdAt: "2026-08-07T13:00:00.000Z",
};

describe("loaders de edição de metas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.getGoalById.mockResolvedValue({ data: goal, error: null });
    mocks.getContributionById.mockResolvedValue({
      data: contribution,
      error: null,
    });
    mocks.listGoals.mockResolvedValue({ data: [goal], error: null });
  });

  it("carrega meta por id dentro do workspace visível", async () => {
    const result = await loadGoalForEdit(client, "user-id", goal.id);

    expect(mocks.getGoalById).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      goalId: goal.id,
    });
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        goal,
      },
    });
  });

  it("mantém ausência de workspace como estado separado", async () => {
    mocks.getCurrentWorkspace.mockResolvedValue({ data: null, error: null });

    await expect(loadGoalForEdit(client, "user-id", goal.id)).resolves.toEqual({
      status: "no_workspace",
    });
    expect(mocks.getGoalById).not.toHaveBeenCalled();
  });

  it("torna meta ausente, invisível e falha indistinguíveis", async () => {
    mocks.getGoalById
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const missing = await loadGoalForEdit(client, "user-id", "missing-id");
    const invisible = await loadGoalForEdit(client, "user-id", "invisible-id");

    expect(missing).toEqual({ status: "error" });
    expect(invisible).toEqual(missing);
  });

  it("carrega aporte órfão e metas disponíveis para reatribuição", async () => {
    const result = await loadContributionForEdit(
      client,
      "user-id",
      contribution.id,
    );

    expect(mocks.getContributionById).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      transactionId: contribution.id,
    });
    expect(mocks.listGoals).toHaveBeenCalledWith(client, "workspace-id");
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        contribution,
        goals: [goal],
      },
    });
  });

  it("torna aporte ausente, invisível ou falha de metas indistinguíveis", async () => {
    mocks.getContributionById
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" })
      .mockResolvedValueOnce({ data: contribution, error: null });
    mocks.listGoals.mockResolvedValueOnce({
      data: null,
      error: "query_failed",
    });

    const missing = await loadContributionForEdit(
      client,
      "user-id",
      "missing-id",
    );
    const invisible = await loadContributionForEdit(
      client,
      "user-id",
      "invisible-id",
    );
    const goalFailure = await loadContributionForEdit(
      client,
      "user-id",
      contribution.id,
    );

    expect(missing).toEqual({ status: "error" });
    expect(invisible).toEqual(missing);
    expect(goalFailure).toEqual(missing);
  });
});

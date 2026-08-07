import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWorkspace: vi.fn(),
  listGoalContributions: vi.fn(),
  listGoals: vi.fn(),
}));

vi.mock("@/lib/workspace/repository", () => ({
  getCurrentWorkspace: mocks.getCurrentWorkspace,
}));

vi.mock("@/lib/goals/repository", () => ({
  listGoalContributions: mocks.listGoalContributions,
  listGoals: mocks.listGoals,
}));

import { loadGoalsDashboard } from "@/lib/goals/load-dashboard";

const client = {} as SupabaseClient;
const reserveGoal = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reserva",
  targetAmount: "5000.00",
  suggestedMonthly: "500.00",
  startedOn: "2026-05-07",
  createdAt: "2026-08-01T12:00:00.000Z",
};
const travelGoal = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Viagem",
  targetAmount: "2000.00",
  suggestedMonthly: null,
  startedOn: "2026-08-07",
  createdAt: "2026-07-01T12:00:00.000Z",
};
const contributions = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    goalId: reserveGoal.id,
    createdBy: "user-id",
    amount: "1000.00",
    occurredOn: "2026-08-07",
    createdAt: "2026-08-07T13:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    goalId: reserveGoal.id,
    createdBy: "other-user-id",
    amount: "500.00",
    occurredOn: "2026-07-07",
    createdAt: "2026-07-07T13:00:00.000Z",
  },
];

describe("loadGoalsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentWorkspace.mockResolvedValue({
      data: { id: "workspace-id", name: "Casa" },
      error: null,
    });
    mocks.listGoals.mockResolvedValue({
      data: [reserveGoal, travelGoal],
      error: null,
    });
    mocks.listGoalContributions.mockResolvedValue({
      data: contributions,
      error: null,
    });
  });

  it("agrega aportes por meta no servidor e preserva a ordem do repositório", async () => {
    const result = await loadGoalsDashboard(
      client,
      "user-id",
      new Date("2026-08-07T15:00:00.000Z"),
    );

    expect(mocks.getCurrentWorkspace).toHaveBeenCalledWith(client, "user-id");
    expect(mocks.listGoals).toHaveBeenCalledWith(client, "workspace-id");
    expect(mocks.listGoalContributions).toHaveBeenCalledWith(client, {
      workspaceId: "workspace-id",
      throughDate: "2026-08-07",
    });
    expect(result).toEqual({
      status: "ready",
      data: {
        workspace: { id: "workspace-id", name: "Casa" },
        today: "2026-08-07",
        goals: [
          {
            ...reserveGoal,
            contributions,
            contributionCount: 2,
            progress: {
              totalContributedCents: 150_000,
              targetCents: 500_000,
              completedCycles: 3,
              expectedCents: 150_000,
              paceDeltaCents: 0,
              paceStatus: "on_track",
              paceUnits: 0,
              completed: false,
              percentage: 30,
              barPercentage: 30,
            },
          },
          {
            ...travelGoal,
            contributions: [],
            contributionCount: 0,
            progress: {
              totalContributedCents: 0,
              targetCents: 200_000,
              completedCycles: 0,
              expectedCents: null,
              paceDeltaCents: null,
              paceStatus: "no_pace",
              paceUnits: null,
              completed: false,
              percentage: 0,
              barPercentage: 0,
            },
          },
        ],
      },
    });
  });

  it("separa ausência de workspace de falha de leitura", async () => {
    mocks.getCurrentWorkspace.mockResolvedValueOnce({ data: null, error: null });
    const withoutWorkspace = await loadGoalsDashboard(client, "user-id");

    mocks.getCurrentWorkspace.mockResolvedValueOnce({
      data: null,
      error: "query_failed",
    });
    const failed = await loadGoalsDashboard(client, "user-id");

    expect(withoutWorkspace).toEqual({ status: "no_workspace" });
    expect(failed).toEqual({ status: "error" });
    expect(mocks.listGoals).not.toHaveBeenCalled();
  });

  it("reduz falha de metas ou aportes ao mesmo estado genérico", async () => {
    mocks.listGoals
      .mockResolvedValueOnce({ data: null, error: "query_failed" })
      .mockResolvedValueOnce({ data: [reserveGoal], error: null });
    mocks.listGoalContributions
      .mockResolvedValueOnce({ data: contributions, error: null })
      .mockResolvedValueOnce({ data: null, error: "query_failed" });

    const goalFailure = await loadGoalsDashboard(client, "user-id");
    const contributionFailure = await loadGoalsDashboard(client, "user-id");

    expect(goalFailure).toEqual({ status: "error" });
    expect(contributionFailure).toEqual(goalFailure);
  });

  it("reduz dado monetário inválido a estado genérico", async () => {
    mocks.listGoals.mockResolvedValue({
      data: [{ ...reserveGoal, targetAmount: "invalid" }],
      error: null,
    });

    await expect(loadGoalsDashboard(client, "user-id")).resolves.toEqual({
      status: "error",
    });
  });
});

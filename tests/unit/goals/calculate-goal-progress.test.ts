import { describe, expect, it } from "vitest";
import {
  calculateCompletedMonthlyCycles,
  calculateGoalProgress,
} from "@/lib/goals/calculate-goal-progress";

const baseGoal = {
  targetAmount: "5000.00",
  suggestedMonthly: "1000.00",
  startedOn: "2026-05-15",
};

describe("calculateCompletedMonthlyCycles", () => {
  it("não cobra ciclo no dia da criação nem antes do primeiro aniversário", () => {
    expect(calculateCompletedMonthlyCycles("2026-08-07", "2026-08-07")).toBe(
      0,
    );
    expect(calculateCompletedMonthlyCycles("2026-08-07", "2026-09-06")).toBe(
      0,
    );
    expect(calculateCompletedMonthlyCycles("2026-08-07", "2026-09-07")).toBe(
      1,
    );
  });

  it("ajusta aniversários no fim de meses curtos", () => {
    expect(calculateCompletedMonthlyCycles("2026-01-31", "2026-02-27")).toBe(
      0,
    );
    expect(calculateCompletedMonthlyCycles("2026-01-31", "2026-02-28")).toBe(
      1,
    );
    expect(calculateCompletedMonthlyCycles("2024-01-31", "2024-02-29")).toBe(
      1,
    );
    expect(calculateCompletedMonthlyCycles("2026-05-31", "2026-08-30")).toBe(
      2,
    );
    expect(calculateCompletedMonthlyCycles("2026-05-31", "2026-08-31")).toBe(
      3,
    );
  });
});

describe("calculateGoalProgress", () => {
  it("agrega aportes ocorridos até a data de referência e ignora futuros", () => {
    const result = calculateGoalProgress(
      baseGoal,
      [
        { amount: "1000.00", occurredOn: "2026-06-01" },
        { amount: "250.50", occurredOn: "2026-08-15" },
        { amount: "999.00", occurredOn: "2026-08-16" },
      ],
      "2026-08-15",
    );

    expect(result).toMatchObject({
      totalContributedCents: 125_050,
      completedCycles: 3,
      expectedCents: 300_000,
      paceDeltaCents: -174_950,
      paceStatus: "behind",
      paceUnits: 1,
      completed: false,
      percentage: 25,
      barPercentage: 25,
    });
  });

  it("mantém meta recém-criada em dia com expectativa zero", () => {
    expect(
      calculateGoalProgress(
        { ...baseGoal, startedOn: "2026-08-07" },
        [],
        "2026-08-07",
      ),
    ).toMatchObject({
      completedCycles: 0,
      expectedCents: 0,
      paceDeltaCents: 0,
      paceStatus: "on_track",
      paceUnits: 0,
    });
  });

  it("não calcula comparação quando não há ritmo", () => {
    expect(
      calculateGoalProgress(
        { ...baseGoal, suggestedMonthly: null },
        [{ amount: "500.00", occurredOn: "2026-08-01" }],
        "2026-08-15",
      ),
    ).toMatchObject({
      totalContributedCents: 50_000,
      expectedCents: null,
      paceDeltaCents: null,
      paceStatus: "no_pace",
      paceUnits: null,
    });
  });

  it("usa somente ciclos inteiros para o status à frente ou atrás", () => {
    const ahead = calculateGoalProgress(
      baseGoal,
      [{ amount: "4500.00", occurredOn: "2026-08-15" }],
      "2026-08-15",
    );
    const behind = calculateGoalProgress(
      baseGoal,
      [{ amount: "500.00", occurredOn: "2026-08-15" }],
      "2026-08-15",
    );

    expect(ahead).toMatchObject({
      paceStatus: "ahead",
      paceDeltaCents: 150_000,
      paceUnits: 1,
    });
    expect(behind).toMatchObject({
      paceStatus: "behind",
      paceDeltaCents: -250_000,
      paceUnits: 2,
    });
  });

  it("faz a conclusão prevalecer e limita somente a barra visual a 100%", () => {
    expect(
      calculateGoalProgress(
        { ...baseGoal, targetAmount: "3000.00" },
        [{ amount: "3500.00", occurredOn: "2026-08-15" }],
        "2026-08-15",
      ),
    ).toMatchObject({
      totalContributedCents: 350_000,
      completed: true,
      percentage: 117,
      barPercentage: 100,
      paceStatus: "completed",
    });
  });

  it("recalcula conclusão ao editar o alvo sem alterar os aportes", () => {
    const contributions = [
      { amount: "3000.00", occurredOn: "2026-08-15" },
    ];
    const raised = calculateGoalProgress(
      { ...baseGoal, targetAmount: "4000.00" },
      contributions,
      "2026-08-15",
    );
    const lowered = calculateGoalProgress(
      { ...baseGoal, targetAmount: "2500.00" },
      contributions,
      "2026-08-15",
    );

    expect(raised).toMatchObject({
      totalContributedCents: 300_000,
      completed: false,
      percentage: 75,
    });
    expect(lowered).toMatchObject({
      totalContributedCents: 300_000,
      completed: true,
      percentage: 120,
      barPercentage: 100,
    });
  });

  it("recalcula todo o ritmo editado desde a data inicial", () => {
    const contributions = [
      { amount: "2000.00", occurredOn: "2026-08-15" },
    ];
    const fasterThanPace = calculateGoalProgress(
      { ...baseGoal, suggestedMonthly: "500.00" },
      contributions,
      "2026-08-15",
    );
    const behindPace = calculateGoalProgress(
      { ...baseGoal, suggestedMonthly: "1000.00" },
      contributions,
      "2026-08-15",
    );

    expect(fasterThanPace).toMatchObject({
      completedCycles: 3,
      expectedCents: 150_000,
      paceStatus: "ahead",
      paceUnits: 1,
    });
    expect(behindPace).toMatchObject({
      completedCycles: 3,
      expectedCents: 300_000,
      paceStatus: "behind",
      paceUnits: 1,
    });
  });
});

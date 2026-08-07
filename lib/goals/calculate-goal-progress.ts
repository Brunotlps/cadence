import { isValidCivilDate } from "@/lib/transactions/civil-date";
import { parseAmountToCents } from "@/lib/transactions/money";

export type GoalProgressInput = {
  targetAmount: string;
  suggestedMonthly: string | null;
  startedOn: string;
};

export type GoalProgressContribution = {
  amount: string;
  occurredOn: string;
};

export type GoalPaceStatus =
  | "ahead"
  | "behind"
  | "on_track"
  | "no_pace"
  | "completed";

export type GoalProgress = {
  totalContributedCents: number;
  targetCents: number;
  completedCycles: number;
  expectedCents: number | null;
  paceDeltaCents: number | null;
  paceStatus: GoalPaceStatus;
  paceUnits: number | null;
  completed: boolean;
  percentage: number;
  barPercentage: number;
};

function civilDateParts(value: string): {
  year: number;
  month: number;
  day: number;
} {
  if (!isValidCivilDate(value)) throw new RangeError("invalid civil date");
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addSafeCents(current: number, amount: number): number {
  const total = current + amount;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("goal progress exceeds the safe integer range");
  }
  return total;
}

function positiveCents(value: string, field: string): number {
  const cents = parseAmountToCents(value);
  if (cents === null || cents <= 0) {
    throw new TypeError(`${field} must be a positive numeric value`);
  }
  return cents;
}

export function calculateCompletedMonthlyCycles(
  startedOn: string,
  referenceOn: string,
): number {
  const start = civilDateParts(startedOn);
  const reference = civilDateParts(referenceOn);
  let months =
    (reference.year - start.year) * 12 + (reference.month - start.month);

  if (months <= 0) return 0;

  const anniversaryDay = Math.min(
    start.day,
    daysInMonth(reference.year, reference.month),
  );
  if (reference.day < anniversaryDay) months -= 1;

  return Math.max(0, months);
}

export function calculateGoalProgress(
  goal: GoalProgressInput,
  contributions: ReadonlyArray<GoalProgressContribution>,
  referenceOn: string,
): GoalProgress {
  if (!isValidCivilDate(referenceOn)) {
    throw new RangeError("referenceOn must be a valid civil date");
  }

  const targetCents = positiveCents(goal.targetAmount, "targetAmount");
  const suggestedMonthlyCents =
    goal.suggestedMonthly === null
      ? null
      : positiveCents(goal.suggestedMonthly, "suggestedMonthly");
  const completedCycles = calculateCompletedMonthlyCycles(
    goal.startedOn,
    referenceOn,
  );

  let totalContributedCents = 0;
  for (const contribution of contributions) {
    if (!isValidCivilDate(contribution.occurredOn)) {
      throw new TypeError("contribution occurredOn must be a valid civil date");
    }
    const amountCents = positiveCents(contribution.amount, "contribution amount");
    if (contribution.occurredOn <= referenceOn) {
      totalContributedCents = addSafeCents(
        totalContributedCents,
        amountCents,
      );
    }
  }

  const completed = totalContributedCents >= targetCents;
  const percentage = Math.round((totalContributedCents / targetCents) * 100);
  const barPercentage = Math.min(100, percentage);

  let expectedCents: number | null = null;
  let paceDeltaCents: number | null = null;
  let paceStatus: GoalPaceStatus = "no_pace";
  let paceUnits: number | null = null;

  if (suggestedMonthlyCents !== null) {
    const uncappedExpected =
      BigInt(suggestedMonthlyCents) * BigInt(completedCycles);
    expectedCents = Number(
      uncappedExpected > BigInt(targetCents)
        ? BigInt(targetCents)
        : uncappedExpected,
    );
    paceDeltaCents = totalContributedCents - expectedCents;
    paceUnits = Math.floor(
      Math.abs(paceDeltaCents) / suggestedMonthlyCents,
    );
    paceStatus =
      paceUnits === 0
        ? "on_track"
        : paceDeltaCents > 0
          ? "ahead"
          : "behind";
  }

  if (completed) paceStatus = "completed";

  return {
    totalContributedCents,
    targetCents,
    completedCycles,
    expectedCents,
    paceDeltaCents,
    paceStatus,
    paceUnits,
    completed,
    percentage,
    barPercentage,
  };
}

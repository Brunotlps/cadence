import {
  centsToNumeric,
  MAX_NUMERIC_12_2_CENTS,
  parseAmountToCents,
} from "@/lib/transactions/money";

const MAX_GOAL_NAME_LENGTH = 100;

export type GoalInput = {
  name: unknown;
  targetAmount: unknown;
  suggestedMonthly?: unknown;
};

export type NormalizedGoalInput = {
  name: string;
  targetAmount: string;
  targetAmountCents: number;
  suggestedMonthly: string | null;
  suggestedMonthlyCents: number | null;
};

export type GoalValidationResult =
  | { success: true; data: NormalizedGoalInput }
  | { success: false; fieldErrors: Record<string, string> };

function parsePositiveAmount(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cents = parseAmountToCents(value);
  if (
    cents === null ||
    cents <= 0 ||
    cents > MAX_NUMERIC_12_2_CENTS
  ) {
    return null;
  }
  return cents;
}

export function validateGoalInput(input: GoalInput): GoalValidationResult {
  const fieldErrors: Record<string, string> = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > MAX_GOAL_NAME_LENGTH) {
    fieldErrors.name = "Informe um nome com até 100 caracteres.";
  }

  const targetAmountCents = parsePositiveAmount(input.targetAmount);
  if (targetAmountCents === null) {
    fieldErrors.targetAmount = "Informe um valor-alvo válido.";
  }

  const rawSuggestedMonthly =
    typeof input.suggestedMonthly === "string"
      ? input.suggestedMonthly.trim()
      : "";
  const suggestedMonthlyCents = rawSuggestedMonthly
    ? parsePositiveAmount(rawSuggestedMonthly)
    : null;
  if (rawSuggestedMonthly && suggestedMonthlyCents === null) {
    fieldErrors.suggestedMonthly = "Informe um ritmo mensal válido.";
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    targetAmountCents === null
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      name,
      targetAmount: centsToNumeric(targetAmountCents),
      targetAmountCents,
      suggestedMonthly:
        suggestedMonthlyCents === null
          ? null
          : centsToNumeric(suggestedMonthlyCents),
      suggestedMonthlyCents,
    },
  };
}

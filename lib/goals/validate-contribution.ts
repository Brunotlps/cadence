import { isValidCivilDate } from "@/lib/transactions/civil-date";
import {
  centsToNumeric,
  MAX_NUMERIC_12_2_CENTS,
  parseAmountToCents,
} from "@/lib/transactions/money";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ContributionInput = {
  amount: unknown;
  occurredOn: unknown;
  goalId: unknown;
};

export type NormalizedContributionInput = {
  amount: string;
  amountCents: number;
  occurredOn: string;
  goalId: string;
};

export type ContributionValidationResult =
  | { success: true; data: NormalizedContributionInput }
  | { success: false; fieldErrors: Record<string, string> };

export function validateContributionInput(
  input: ContributionInput,
  today: string,
): ContributionValidationResult {
  if (!isValidCivilDate(today)) {
    throw new RangeError("today must be a valid civil date");
  }

  const fieldErrors: Record<string, string> = {};
  const amountCents =
    typeof input.amount === "string" ? parseAmountToCents(input.amount) : null;
  if (
    amountCents === null ||
    amountCents <= 0 ||
    amountCents > MAX_NUMERIC_12_2_CENTS
  ) {
    fieldErrors.amount = "Informe um valor válido.";
  }

  const occurredOn =
    typeof input.occurredOn === "string" &&
    isValidCivilDate(input.occurredOn) &&
    input.occurredOn <= today
      ? input.occurredOn
      : null;
  if (!occurredOn) {
    fieldErrors.occurredOn = "Informe uma data válida, sem usar data futura.";
  }

  const goalId =
    typeof input.goalId === "string" && UUID_PATTERN.test(input.goalId)
      ? input.goalId
      : null;
  if (!goalId) {
    fieldErrors.goalId = "Selecione uma meta válida.";
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    amountCents === null ||
    !occurredOn ||
    !goalId
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      amount: centsToNumeric(amountCents),
      amountCents,
      occurredOn,
      goalId,
    },
  };
}

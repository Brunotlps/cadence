import {
  deriveTransactionKind,
  isTransactionCategoryCode,
  type TransactionCategoryCode,
} from "@/lib/transactions/categories";
import {
  centsToNumeric,
  MAX_NUMERIC_12_2_CENTS,
  parseAmountToCents,
} from "@/lib/transactions/money";

const MAX_NAME_LENGTH = 100;
const MIN_DUE_DAY = 1;
const MAX_DUE_DAY = 31;

export type FixedBillInput = {
  name: unknown;
  dueDay: unknown;
  category: unknown;
  estimatedAmount: unknown;
  autopay?: unknown;
  variableAmount?: unknown;
};

export type NormalizedFixedBillInput = {
  name: string;
  dueDay: number;
  category: TransactionCategoryCode;
  estimatedAmount: string;
  estimatedAmountCents: number;
  autopay: boolean;
  variableAmount: boolean;
};

export type FixedBillValidationResult =
  | { success: true; data: NormalizedFixedBillInput }
  | { success: false; fieldErrors: Record<string, string> };

// Caixa de seleção não marcada simplesmente não chega no FormData. Ausência é
// "false", nunca erro de campo.
function normalizeCheckbox(value: unknown): boolean {
  return value === true || value === "on" || value === "true";
}

function parseDueDay(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const dueDay = Number(trimmed);
  return dueDay >= MIN_DUE_DAY && dueDay <= MAX_DUE_DAY ? dueDay : null;
}

export function validateFixedBillInput(
  input: FixedBillInput,
): FixedBillValidationResult {
  const fieldErrors: Record<string, string> = {};

  const rawName = typeof input.name === "string" ? input.name.trim() : "";
  const name = rawName || null;
  if (!name || name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = "Informe um nome de até 100 caracteres.";
  }

  const dueDay = parseDueDay(input.dueDay);
  if (dueDay === null) {
    fieldErrors.dueDay = "Informe um dia entre 1 e 31.";
  }

  // Pagar gera uma despesa, então a categoria da conta precisa ser de despesa:
  // Renda derivaria kind='income' e o lançamento seria rejeitado pelo banco.
  const category =
    typeof input.category === "string" &&
    isTransactionCategoryCode(input.category) &&
    deriveTransactionKind(input.category) === "expense"
      ? input.category
      : null;
  if (!category) {
    fieldErrors.category = "Selecione uma categoria de despesa válida.";
  }

  const estimatedAmountCents =
    typeof input.estimatedAmount === "string"
      ? parseAmountToCents(input.estimatedAmount)
      : null;
  if (
    estimatedAmountCents === null ||
    estimatedAmountCents <= 0 ||
    estimatedAmountCents > MAX_NUMERIC_12_2_CENTS
  ) {
    fieldErrors.estimatedAmount = "Informe um valor previsto válido.";
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !name ||
    dueDay === null ||
    !category ||
    estimatedAmountCents === null
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      name,
      dueDay,
      category,
      estimatedAmount: centsToNumeric(estimatedAmountCents),
      estimatedAmountCents,
      autopay: normalizeCheckbox(input.autopay),
      variableAmount: normalizeCheckbox(input.variableAmount),
    },
  };
}

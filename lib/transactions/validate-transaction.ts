import {
  deriveTransactionKind,
  isTransactionCategoryCode,
  type TransactionCategoryCode,
} from "./categories";
import { isValidCivilDate } from "./civil-date";
import {
  centsToNumeric,
  MAX_NUMERIC_12_2_CENTS,
  parseAmountToCents,
} from "./money";
import {
  isPaymentMethodCode,
  type PaymentMethodCode,
} from "./payment-methods";
import type { EntryTransactionKind } from "./kinds";

const MAX_DESCRIPTION_LENGTH = 200;

export type TransactionInput = {
  amount: unknown;
  category: unknown;
  occurredOn: unknown;
  description?: unknown;
  paymentMethod?: unknown;
};

export type NormalizedTransactionInput = {
  amount: string;
  amountCents: number;
  category: TransactionCategoryCode;
  kind: EntryTransactionKind;
  occurredOn: string;
  description: string | null;
  paymentMethod: PaymentMethodCode | null;
};

export type TransactionValidationResult =
  | { success: true; data: NormalizedTransactionInput }
  | { success: false; fieldErrors: Record<string, string> };

export function validateTransactionInput(
  input: TransactionInput,
): TransactionValidationResult {
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

  const category =
    typeof input.category === "string" &&
    isTransactionCategoryCode(input.category)
      ? input.category
      : null;
  if (!category) {
    fieldErrors.category = "Selecione uma categoria válida.";
  }

  const occurredOn =
    typeof input.occurredOn === "string" && isValidCivilDate(input.occurredOn)
      ? input.occurredOn
      : null;
  if (!occurredOn) {
    fieldErrors.occurredOn = "Informe uma data válida.";
  }

  const rawDescription =
    typeof input.description === "string" ? input.description.trim() : "";
  const description = rawDescription || null;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = "A descrição deve ter no máximo 200 caracteres.";
  }

  const rawPaymentMethod =
    typeof input.paymentMethod === "string" ? input.paymentMethod.trim() : "";
  const paymentMethod = rawPaymentMethod || null;
  if (paymentMethod && !isPaymentMethodCode(paymentMethod)) {
    fieldErrors.paymentMethod = "Selecione uma forma de pagamento válida.";
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    amountCents === null ||
    !category ||
    !occurredOn
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      amount: centsToNumeric(amountCents),
      amountCents,
      category,
      kind: deriveTransactionKind(category),
      occurredOn,
      description,
      paymentMethod: paymentMethod as PaymentMethodCode | null,
    },
  };
}

import { isValidCivilDate } from "@/lib/transactions/civil-date";
import {
  centsToNumeric,
  MAX_NUMERIC_12_2_CENTS,
  parseAmountToCents,
} from "@/lib/transactions/money";
import {
  isPaymentMethodCode,
  type PaymentMethodCode,
} from "@/lib/transactions/payment-methods";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BillPaymentInput = {
  amount: unknown;
  occurredOn: unknown;
  fixedBillId: unknown;
  paymentMethod?: unknown;
};

export type NormalizedBillPaymentInput = {
  amount: string;
  amountCents: number;
  occurredOn: string;
  paymentMethod: PaymentMethodCode | null;
  fixedBillId: string;
};

export type BillPaymentValidationResult =
  | { success: true; data: NormalizedBillPaymentInput }
  | { success: false; fieldErrors: Record<string, string> };

export function validateBillPaymentInput(
  input: BillPaymentInput,
  today: string,
): BillPaymentValidationResult {
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

  // Pagamento retroativo é legítimo; pagamento futuro não, pela mesma razão do
  // aporte — registrar o que ainda não aconteceu falsearia o mês.
  const occurredOn =
    typeof input.occurredOn === "string" &&
    isValidCivilDate(input.occurredOn) &&
    input.occurredOn <= today
      ? input.occurredOn
      : null;
  if (!occurredOn) {
    fieldErrors.occurredOn = "Informe uma data válida, sem usar data futura.";
  }

  const rawPaymentMethod =
    typeof input.paymentMethod === "string" ? input.paymentMethod.trim() : "";
  const paymentMethod = rawPaymentMethod || null;
  if (paymentMethod && !isPaymentMethodCode(paymentMethod)) {
    fieldErrors.paymentMethod = "Selecione uma forma de pagamento válida.";
  }

  const fixedBillId =
    typeof input.fixedBillId === "string" && UUID_PATTERN.test(input.fixedBillId)
      ? input.fixedBillId
      : null;
  if (!fixedBillId) {
    fieldErrors.fixedBillId = "Selecione uma conta fixa válida.";
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    amountCents === null ||
    !occurredOn ||
    !fixedBillId
  ) {
    return { success: false, fieldErrors };
  }

  return {
    success: true,
    data: {
      amount: centsToNumeric(amountCents),
      amountCents,
      occurredOn,
      paymentMethod: paymentMethod as PaymentMethodCode | null,
      fixedBillId,
    },
  };
}

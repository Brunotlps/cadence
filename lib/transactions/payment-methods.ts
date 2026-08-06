export const PAYMENT_METHODS = [
  { code: "pix", label: "Pix" },
  { code: "credit_card", label: "Cartão de crédito" },
  { code: "debit_card", label: "Cartão de débito" },
  { code: "cash", label: "Dinheiro" },
  { code: "boleto", label: "Boleto" },
  { code: "bank_transfer", label: "Transferência" },
  { code: "other", label: "Outro" },
] as const satisfies ReadonlyArray<{ code: string; label: string }>;

export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]["code"];

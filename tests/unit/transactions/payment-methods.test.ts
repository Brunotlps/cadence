import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS } from "@/lib/transactions/payment-methods";

describe("formas de pagamento", () => {
  it("mantém exatamente a lista fixa aprovada, com códigos estáveis", () => {
    expect(PAYMENT_METHODS).toEqual([
      { code: "pix", label: "Pix" },
      { code: "credit_card", label: "Cartão de crédito" },
      { code: "debit_card", label: "Cartão de débito" },
      { code: "cash", label: "Dinheiro" },
      { code: "boleto", label: "Boleto" },
      { code: "bank_transfer", label: "Transferência" },
      { code: "other", label: "Outro" },
    ]);
  });

  it("usa códigos únicos em snake_case como valores persistidos", () => {
    const codes = PAYMENT_METHODS.map(({ code }) => code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[a-z]+(?:_[a-z]+)*$/.test(code))).toBe(true);
  });
});

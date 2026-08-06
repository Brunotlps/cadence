import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "@/lib/transactions/validate-transaction";

const TODAY = "2026-08-06";

const validInput = {
  amount: "1.234,56",
  category: "alimentacao",
  occurredOn: "2026-08-05",
  description: "  Mercado do mês  ",
  paymentMethod: "pix",
};

function expectFieldError(
  result: ReturnType<typeof validateTransactionInput>,
  field: string,
) {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Esperava resultado de validação inválido");
  expect(result.fieldErrors).toHaveProperty(field);
  expect(result.fieldErrors[field]).toEqual(expect.any(String));
}

describe("validateTransactionInput", () => {
  it("normaliza uma despesa válida para o formato persistido", () => {
    expect(validateTransactionInput(validInput, { today: TODAY })).toEqual({
      success: true,
      data: {
        amount: "1234.56",
        amountCents: 123456,
        category: "alimentacao",
        kind: "expense",
        occurredOn: "2026-08-05",
        description: "Mercado do mês",
        paymentMethod: "pix",
      },
    });
  });

  it("deriva income de Renda e permite explicar outra origem na descrição", () => {
    const result = validateTransactionInput(
      {
        ...validInput,
        category: "renda",
        description: "Reembolso de viagem",
        paymentMethod: "bank_transfer",
      },
      { today: TODAY },
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        category: "renda",
        kind: "income",
        description: "Reembolso de viagem",
      },
    });
  });

  it("converte detalhes opcionais vazios em null", () => {
    const result = validateTransactionInput(
      { ...validInput, description: "  ", paymentMethod: "" },
      { today: TODAY },
    );

    expect(result).toMatchObject({
      success: true,
      data: { description: null, paymentMethod: null },
    });
  });

  it.each(["0", "-1,00", "10.000.000.000,00", "abc"])(
    "rejeita o valor inválido %s",
    (amount) => {
      expectFieldError(
        validateTransactionInput({ ...validInput, amount }, { today: TODAY }),
        "amount",
      );
    },
  );

  it.each(["", "viagem", "Renda"])(
    "rejeita o código de categoria inválido %j",
    (category) => {
      expectFieldError(
        validateTransactionInput({ ...validInput, category }, { today: TODAY }),
        "category",
      );
    },
  );

  it("rejeita uma data inexistente", () => {
    expectFieldError(
      validateTransactionInput(
        { ...validInput, occurredOn: "2026-02-29" },
        { today: TODAY },
      ),
      "occurredOn",
    );
  });

  it("rejeita descrição acima de 200 caracteres", () => {
    expectFieldError(
      validateTransactionInput(
        { ...validInput, description: "a".repeat(201) },
        { today: TODAY },
      ),
      "description",
    );
  });

  it("rejeita forma de pagamento fora da lista fixa", () => {
    expectFieldError(
      validateTransactionInput(
        { ...validInput, paymentMethod: "crypto" },
        { today: TODAY },
      ),
      "paymentMethod",
    );
  });
});

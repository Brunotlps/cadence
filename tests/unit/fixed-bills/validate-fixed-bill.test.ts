import { describe, expect, it } from "vitest";
import { validateFixedBillInput } from "@/lib/fixed-bills/validate-fixed-bill";

const validInput = {
  name: "  Conta de luz  ",
  dueDay: "5",
  category: "luz",
  estimatedAmount: "1.180,50",
  autopay: "on",
  variableAmount: "on",
};

function expectFieldError(
  result: ReturnType<typeof validateFixedBillInput>,
  field: string,
) {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Esperava conta fixa inválida");
  expect(result.fieldErrors).toHaveProperty(field);
  expect(result.fieldErrors[field]).toEqual(expect.any(String));
}

describe("validateFixedBillInput", () => {
  it("normaliza os campos para o formato persistido", () => {
    expect(validateFixedBillInput(validInput)).toEqual({
      success: true,
      data: {
        name: "Conta de luz",
        dueDay: 5,
        category: "luz",
        estimatedAmount: "1180.50",
        estimatedAmountCents: 118_050,
        autopay: true,
        variableAmount: true,
      },
    });
  });

  it("trata caixa de seleção ausente como falso, sem erro de campo", () => {
    expect(
      validateFixedBillInput({
        ...validInput,
        autopay: null,
        variableAmount: undefined,
      }),
    ).toMatchObject({
      success: true,
      data: { autopay: false, variableAmount: false },
    });
  });

  it.each(["", "   ", "a".repeat(101)])(
    "rejeita nome vazio ou acima do limite (%s)",
    (name) => {
      expectFieldError(validateFixedBillInput({ ...validInput, name }), "name");
    },
  );

  it("aceita o dia 31, que a leitura ajusta em meses curtos", () => {
    expect(
      validateFixedBillInput({ ...validInput, dueDay: "31" }),
    ).toMatchObject({ success: true, data: { dueDay: 31 } });
  });

  it.each(["0", "32", "5,5", "5.5", "abc", "", "  "])(
    "rejeita dia de vencimento inválido (%s)",
    (dueDay) => {
      expectFieldError(
        validateFixedBillInput({ ...validInput, dueDay }),
        "dueDay",
      );
    },
  );

  it("rejeita categoria de receita, porque pagamento é sempre despesa", () => {
    expectFieldError(
      validateFixedBillInput({ ...validInput, category: "renda" }),
      "category",
    );
  });

  it.each(["", "inexistente", "Luz"])(
    "rejeita categoria fora do domínio persistido (%s)",
    (category) => {
      expectFieldError(
        validateFixedBillInput({ ...validInput, category }),
        "category",
      );
    },
  );

  it.each(["0", "-1,00", "10.000.000.000,00", "abc", "", "  "])(
    "rejeita estimativa inválida (%s)",
    (estimatedAmount) => {
      expectFieldError(
        validateFixedBillInput({ ...validInput, estimatedAmount }),
        "estimatedAmount",
      );
    },
  );

  it("exige estimativa também quando o valor é variável", () => {
    expectFieldError(
      validateFixedBillInput({
        ...validInput,
        variableAmount: "on",
        estimatedAmount: "",
      }),
      "estimatedAmount",
    );
  });

  it("não ecoa o input inválido de volta", () => {
    const result = validateFixedBillInput({
      ...validInput,
      name: "",
      estimatedAmount: "abc",
    });

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty("data");
    expect(Object.keys(result.success ? {} : result.fieldErrors).sort()).toEqual(
      ["estimatedAmount", "name"],
    );
  });
});

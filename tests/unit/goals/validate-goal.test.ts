import { describe, expect, it } from "vitest";
import { validateGoalInput } from "@/lib/goals/validate-goal";

const validInput = {
  name: "  Reserva de emergência  ",
  targetAmount: "50.000,00",
  suggestedMonthly: "1.250,50",
};

function expectFieldError(
  result: ReturnType<typeof validateGoalInput>,
  field: string,
) {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Esperava meta inválida");
  expect(result.fieldErrors).toHaveProperty(field);
  expect(result.fieldErrors[field]).toEqual(expect.any(String));
}

describe("validateGoalInput", () => {
  it("normaliza nome, alvo e ritmo para o formato persistido", () => {
    expect(validateGoalInput(validInput)).toEqual({
      success: true,
      data: {
        name: "Reserva de emergência",
        targetAmount: "50000.00",
        targetAmountCents: 5_000_000,
        suggestedMonthly: "1250.50",
        suggestedMonthlyCents: 125_050,
      },
    });
  });

  it("converte ritmo opcional vazio em null", () => {
    expect(
      validateGoalInput({ ...validInput, suggestedMonthly: "  " }),
    ).toMatchObject({
      success: true,
      data: {
        suggestedMonthly: null,
        suggestedMonthlyCents: null,
      },
    });
  });

  it.each(["", "   ", "a".repeat(101)])(
    "rejeita nome vazio ou acima do limite",
    (name) => {
      expectFieldError(validateGoalInput({ ...validInput, name }), "name");
    },
  );

  it.each(["0", "-1,00", "10.000.000.000,00", "abc"])(
    "rejeita valor-alvo inválido %s",
    (targetAmount) => {
      expectFieldError(
        validateGoalInput({ ...validInput, targetAmount }),
        "targetAmount",
      );
    },
  );

  it.each(["0", "-1,00", "10.000.000.000,00", "abc"])(
    "rejeita ritmo informado que não seja positivo e válido %s",
    (suggestedMonthly) => {
      expectFieldError(
        validateGoalInput({ ...validInput, suggestedMonthly }),
        "suggestedMonthly",
      );
    },
  );
});

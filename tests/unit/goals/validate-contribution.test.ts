import { describe, expect, it } from "vitest";
import { validateContributionInput } from "@/lib/goals/validate-contribution";

const GOAL_ID = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-08-07";
const validInput = {
  amount: "1.234,56",
  occurredOn: TODAY,
  goalId: GOAL_ID,
};

function expectFieldError(
  result: ReturnType<typeof validateContributionInput>,
  field: string,
) {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Esperava aporte inválido");
  expect(result.fieldErrors).toHaveProperty(field);
  expect(result.fieldErrors[field]).toEqual(expect.any(String));
}

describe("validateContributionInput", () => {
  it("normaliza um aporte sem aceitar campos de despesa", () => {
    expect(validateContributionInput(validInput, TODAY)).toEqual({
      success: true,
      data: {
        amount: "1234.56",
        amountCents: 123_456,
        occurredOn: TODAY,
        goalId: GOAL_ID,
      },
    });
  });

  it("permite aporte retroativo", () => {
    expect(
      validateContributionInput(
        { ...validInput, occurredOn: "2025-12-31" },
        TODAY,
      ),
    ).toMatchObject({ success: true });
  });

  it("rejeita aporte com data futura", () => {
    expectFieldError(
      validateContributionInput(
        { ...validInput, occurredOn: "2026-08-08" },
        TODAY,
      ),
      "occurredOn",
    );
  });

  it.each(["", "2026-02-29", "07/08/2026"])(
    "rejeita data civil inválida %j",
    (occurredOn) => {
      expectFieldError(
        validateContributionInput({ ...validInput, occurredOn }, TODAY),
        "occurredOn",
      );
    },
  );

  it.each(["0", "-1,00", "10.000.000.000,00", "abc"])(
    "rejeita valor inválido %s",
    (amount) => {
      expectFieldError(
        validateContributionInput({ ...validInput, amount }, TODAY),
        "amount",
      );
    },
  );

  it.each(["", "not-a-uuid", "22222222-2222-2222-2222-22222222222"])(
    "rejeita identificador de meta inválido %j",
    (goalId) => {
      expectFieldError(
        validateContributionInput({ ...validInput, goalId }, TODAY),
        "goalId",
      );
    },
  );
});

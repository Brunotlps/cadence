import { describe, expect, it } from "vitest";
import { validateBillPaymentInput } from "@/lib/fixed-bills/validate-bill-payment";

const FIXED_BILL_ID = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-08-10";

const validInput = {
  amount: "1.234,56",
  occurredOn: "2026-08-05",
  paymentMethod: "pix",
  fixedBillId: FIXED_BILL_ID,
};

function expectFieldError(
  result: ReturnType<typeof validateBillPaymentInput>,
  field: string,
) {
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Esperava pagamento inválido");
  expect(result.fieldErrors).toHaveProperty(field);
  expect(result.fieldErrors[field]).toEqual(expect.any(String));
}

describe("validateBillPaymentInput", () => {
  it("normaliza valor, data, forma de pagamento e vínculo", () => {
    expect(validateBillPaymentInput(validInput, TODAY)).toEqual({
      success: true,
      data: {
        amount: "1234.56",
        amountCents: 123_456,
        occurredOn: "2026-08-05",
        paymentMethod: "pix",
        fixedBillId: FIXED_BILL_ID,
      },
    });
  });

  it.each([undefined, null, "", "   "])(
    "converte forma de pagamento ausente em null (%s)",
    (paymentMethod) => {
      expect(
        validateBillPaymentInput({ ...validInput, paymentMethod }, TODAY),
      ).toMatchObject({ success: true, data: { paymentMethod: null } });
    },
  );

  it.each(["dinheiro", "Pix", "cartao"])(
    "rejeita forma de pagamento fora do domínio persistido (%s)",
    (paymentMethod) => {
      expectFieldError(
        validateBillPaymentInput({ ...validInput, paymentMethod }, TODAY),
        "paymentMethod",
      );
    },
  );

  it("aceita pagamento retroativo e pagamento de hoje", () => {
    expect(
      validateBillPaymentInput(
        { ...validInput, occurredOn: "2026-07-05" },
        TODAY,
      ),
    ).toMatchObject({ success: true, data: { occurredOn: "2026-07-05" } });
    expect(
      validateBillPaymentInput({ ...validInput, occurredOn: TODAY }, TODAY),
    ).toMatchObject({ success: true, data: { occurredOn: TODAY } });
  });

  it.each(["2026-08-11", "2026-09-01", "2026-02-30", "2026-8-5", "abc", ""])(
    "rejeita data futura ou inválida (%s)",
    (occurredOn) => {
      expectFieldError(
        validateBillPaymentInput({ ...validInput, occurredOn }, TODAY),
        "occurredOn",
      );
    },
  );

  it.each(["0", "-10,00", "10.000.000.000,00", "abc", ""])(
    "rejeita valor inválido (%s)",
    (amount) => {
      expectFieldError(
        validateBillPaymentInput({ ...validInput, amount }, TODAY),
        "amount",
      );
    },
  );

  it.each(["", "não-é-uuid", "11111111-1111-4111-8111"])(
    "rejeita vínculo que não é uuid (%s)",
    (fixedBillId) => {
      expectFieldError(
        validateBillPaymentInput({ ...validInput, fixedBillId }, TODAY),
        "fixedBillId",
      );
    },
  );

  it("rejeita data de referência inválida como erro de programação", () => {
    expect(() => validateBillPaymentInput(validInput, "2026-8-10")).toThrow(
      RangeError,
    );
  });

  it("não ecoa o input inválido de volta", () => {
    const result = validateBillPaymentInput(
      { ...validInput, amount: "abc", fixedBillId: "x" },
      TODAY,
    );

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty("data");
  });
});

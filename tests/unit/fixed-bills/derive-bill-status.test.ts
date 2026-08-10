import { describe, expect, it } from "vitest";
import { deriveBillStatuses } from "@/lib/fixed-bills/derive-bill-status";

const bills = [
  {
    id: "bill-luz",
    dueDay: 5,
    estimatedAmount: "180.00",
    variableAmount: true,
  },
  {
    id: "bill-aluguel",
    dueDay: 10,
    estimatedAmount: "2500.00",
    variableAmount: false,
  },
  {
    id: "bill-internet",
    dueDay: 20,
    estimatedAmount: "120.00",
    variableAmount: false,
  },
];

function payment(
  fixedBillId: string,
  amount: string,
  occurredOn: string,
  id = `${fixedBillId}-${occurredOn}`,
) {
  return { id, fixedBillId, amount, occurredOn };
}

describe("deriveBillStatuses", () => {
  it("deriva atraso, aviso e pendência no mês corrente", () => {
    const result = deriveBillStatuses(bills, [], {
      month: "2026-08",
      today: "2026-08-08",
    });

    expect(result).toEqual([
      {
        billId: "bill-luz",
        dueOn: "2026-08-05",
        status: "overdue",
        estimatedCents: 18_000,
        paidCents: 0,
        paymentCount: 0,
        payments: [],
      },
      {
        billId: "bill-aluguel",
        dueOn: "2026-08-10",
        status: "due_soon",
        estimatedCents: 250_000,
        paidCents: 0,
        paymentCount: 0,
        payments: [],
      },
      {
        billId: "bill-internet",
        dueOn: "2026-08-20",
        status: "pending",
        estimatedCents: 12_000,
        paidCents: 0,
        paymentCount: 0,
        payments: [],
      },
    ]);
  });

  it("trata os limites exatos da janela de aviso", () => {
    const single = [bills[1]];

    expect(
      deriveBillStatuses(single, [], { month: "2026-08", today: "2026-08-10" })[0]
        .status,
    ).toBe("due_soon");
    expect(
      deriveBillStatuses(single, [], { month: "2026-08", today: "2026-08-05" })[0]
        .status,
    ).toBe("due_soon");
    expect(
      deriveBillStatuses(single, [], { month: "2026-08", today: "2026-08-04" })[0]
        .status,
    ).toBe("pending");
    expect(
      deriveBillStatuses(single, [], { month: "2026-08", today: "2026-08-11" })[0]
        .status,
    ).toBe("overdue");
  });

  it("marca como pago mesmo depois do vencimento e preserva o pagamento", () => {
    const [luz] = deriveBillStatuses(
      bills,
      [payment("bill-luz", "194.32", "2026-08-03")],
      { month: "2026-08", today: "2026-08-08" },
    );

    expect(luz).toMatchObject({
      status: "paid",
      paidCents: 19_432,
      paymentCount: 1,
    });
    expect(luz.payments).toEqual([
      {
        id: "bill-luz-2026-08-03",
        fixedBillId: "bill-luz",
        amount: "194.32",
        occurredOn: "2026-08-03",
      },
    ]);
  });

  it("soma múltiplos pagamentos do mesmo mês", () => {
    const [luz] = deriveBillStatuses(
      bills,
      [
        payment("bill-luz", "100.00", "2026-08-03"),
        payment("bill-luz", "94.32", "2026-08-06"),
      ],
      { month: "2026-08", today: "2026-08-08" },
    );

    expect(luz).toMatchObject({
      status: "paid",
      paidCents: 19_432,
      paymentCount: 2,
    });
  });

  it("preserva campos extras do pagamento sem interpretá-los", () => {
    const [luz] = deriveBillStatuses(
      bills,
      [
        {
          ...payment("bill-luz", "194.32", "2026-08-03"),
          paymentMethod: "pix" as const,
          createdBy: "user-1",
        },
      ],
      { month: "2026-08", today: "2026-08-08" },
    );

    expect(luz.payments[0]).toMatchObject({
      paymentMethod: "pix",
      createdBy: "user-1",
    });
  });

  it("nunca reporta atraso fora do mês corrente", () => {
    const past = deriveBillStatuses(bills, [], {
      month: "2026-07",
      today: "2026-08-08",
    });
    const future = deriveBillStatuses(bills, [], {
      month: "2026-09",
      today: "2026-08-08",
    });

    expect(past.map((item) => item.status)).toEqual([
      "not_recorded",
      "not_recorded",
      "not_recorded",
    ]);
    expect(past.map((item) => item.dueOn)).toEqual([
      "2026-07-05",
      "2026-07-10",
      "2026-07-20",
    ]);
    expect(future.map((item) => item.status)).toEqual([
      "not_recorded",
      "not_recorded",
      "not_recorded",
    ]);
  });

  it("marca meses passados como pagos quando há lançamento vinculado", () => {
    const [luz] = deriveBillStatuses(
      bills,
      [payment("bill-luz", "170.00", "2026-07-04")],
      { month: "2026-07", today: "2026-08-08" },
    );

    expect(luz).toMatchObject({ status: "paid", paidCents: 17_000 });
  });

  it("ignora pagamento fora do mês e de conta desconhecida", () => {
    const result = deriveBillStatuses(
      bills,
      [
        payment("bill-luz", "180.00", "2026-07-31"),
        payment("bill-luz", "180.00", "2026-09-01"),
        payment("bill-removida", "500.00", "2026-08-02"),
      ],
      { month: "2026-08", today: "2026-08-08" },
    );

    expect(result.map((item) => item.status)).toEqual([
      "overdue",
      "due_soon",
      "pending",
    ]);
    expect(result.every((item) => item.paidCents === 0)).toBe(true);
  });

  it("ajusta o vencimento ao último dia de meses curtos", () => {
    const [item] = deriveBillStatuses(
      [{ ...bills[0], dueDay: 31 }],
      [],
      { month: "2026-02", today: "2026-02-27" },
    );

    expect(item).toMatchObject({ dueOn: "2026-02-28", status: "due_soon" });
  });

  it("recalcula na leitura sem tocar no histórico já lançado", () => {
    const payments = [payment("bill-luz", "194.32", "2026-08-03")];
    const reference = { month: "2026-08", today: "2026-08-08" };

    const before = deriveBillStatuses(bills, payments, reference)[0];
    const after = deriveBillStatuses(
      [{ ...bills[0], dueDay: 25, estimatedAmount: "260.00" }],
      payments,
      reference,
    )[0];

    expect(after.dueOn).toBe("2026-08-25");
    expect(after.estimatedCents).toBe(26_000);
    expect(after.paidCents).toBe(before.paidCents);
    expect(after.payments).toEqual(before.payments);
  });

  it("rejeita valores monetários inválidos em vez de silenciar", () => {
    expect(() =>
      deriveBillStatuses([{ ...bills[0], estimatedAmount: "0.00" }], [], {
        month: "2026-08",
        today: "2026-08-08",
      }),
    ).toThrow(TypeError);

    expect(() =>
      deriveBillStatuses(bills, [payment("bill-luz", "abc", "2026-08-03")], {
        month: "2026-08",
        today: "2026-08-08",
      }),
    ).toThrow(TypeError);
  });

  it.each([
    { month: "2026-13", today: "2026-08-08" },
    { month: "2026-8", today: "2026-08-08" },
    { month: "2026-08", today: "2026-08-32" },
    { month: "2026-08", today: "abc" },
  ])("rejeita referência inválida (%o)", (reference) => {
    expect(() => deriveBillStatuses(bills, [], reference)).toThrow(RangeError);
  });
});

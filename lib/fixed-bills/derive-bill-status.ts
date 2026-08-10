import { isValidCivilDate, isValidMonth } from "@/lib/transactions/civil-date";
import { parseAmountToCents } from "@/lib/transactions/money";
import {
  countCivilDaysBetween,
  DUE_SOON_WINDOW_DAYS,
  resolveDueDate,
} from "./due-date";

export type BillMonthStatus =
  | "paid"
  | "due_soon"
  | "overdue"
  | "pending"
  | "not_recorded";

export type BillForStatus = {
  id: string;
  dueDay: number;
  estimatedAmount: string;
  variableAmount: boolean;
};

export type BillPaymentForStatus = {
  id: string;
  fixedBillId: string;
  amount: string;
  occurredOn: string;
};

export type DerivedBillStatus<TPayment extends BillPaymentForStatus> = {
  billId: string;
  dueOn: string;
  status: BillMonthStatus;
  estimatedCents: number;
  paidCents: number;
  paymentCount: number;
  payments: TPayment[];
};

function positiveCents(value: string, field: string): number {
  const cents = parseAmountToCents(value);
  if (cents === null || cents <= 0) {
    throw new TypeError(`${field} must be a positive numeric value`);
  }
  return cents;
}

function addSafeCents(current: number, amount: number): number {
  const total = current + amount;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("bill payments exceed the safe integer range");
  }
  return total;
}

function unpaidStatus(daysUntilDue: number): BillMonthStatus {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) return "due_soon";
  return "pending";
}

export function deriveBillStatuses<TPayment extends BillPaymentForStatus>(
  bills: ReadonlyArray<BillForStatus>,
  payments: ReadonlyArray<TPayment>,
  reference: { month: string; today: string },
): Array<DerivedBillStatus<TPayment>> {
  if (!isValidMonth(reference.month) || !isValidCivilDate(reference.today)) {
    throw new RangeError("reference must use valid civil month and date values");
  }

  const knownBillIds = new Set(bills.map((bill) => bill.id));
  const paymentsByBill = new Map<string, TPayment[]>();

  for (const payment of payments) {
    if (
      !knownBillIds.has(payment.fixedBillId) ||
      !isValidCivilDate(payment.occurredOn) ||
      payment.occurredOn.slice(0, 7) !== reference.month
    ) {
      continue;
    }

    const current = paymentsByBill.get(payment.fixedBillId) ?? [];
    current.push(payment);
    paymentsByBill.set(payment.fixedBillId, current);
  }

  const isCurrentMonth = reference.month === reference.today.slice(0, 7);

  return bills.map((bill) => {
    const estimatedCents = positiveCents(
      bill.estimatedAmount,
      "estimated amount",
    );
    const billPayments = paymentsByBill.get(bill.id) ?? [];
    let paidCents = 0;

    for (const payment of billPayments) {
      paidCents = addSafeCents(
        paidCents,
        positiveCents(payment.amount, "payment amount"),
      );
    }

    const dueOn = resolveDueDate(bill.dueDay, reference.month);
    const status =
      billPayments.length > 0
        ? "paid"
        : isCurrentMonth
          ? unpaidStatus(countCivilDaysBetween(reference.today, dueOn))
          : "not_recorded";

    return {
      billId: bill.id,
      dueOn,
      status,
      estimatedCents,
      paidCents,
      paymentCount: billPayments.length,
      payments: billPayments,
    };
  });
}

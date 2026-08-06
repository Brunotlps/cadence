import {
  TRANSACTION_CATEGORIES,
  type TransactionCategoryCode,
} from "./categories";
import type { TransactionKind } from "./kinds";
import { parseAmountToCents } from "./money";

export type SummaryTransaction = {
  kind: TransactionKind;
  amount: string;
  category: TransactionCategoryCode | null;
};

export type TransactionSummary = {
  incomeCents: number;
  expenseCents: number;
  contributionCents: number;
  balanceCents: number;
  expensesByCategory: Array<{
    category: TransactionCategoryCode;
    totalCents: number;
  }>;
};

const categoryOrder = new Map(
  TRANSACTION_CATEGORIES.map(({ code }, position) => [code, position]),
);

function addSafeCents(current: number, amount: number): number {
  const total = current + amount;
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("transaction summary exceeds the safe integer range");
  }
  return total;
}

export function summarizeTransactions(
  transactions: ReadonlyArray<SummaryTransaction>,
): TransactionSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let contributionCents = 0;
  const expenses = new Map<TransactionCategoryCode, number>();

  for (const transaction of transactions) {
    const amountCents = parseAmountToCents(transaction.amount);
    if (amountCents === null || amountCents <= 0) {
      throw new TypeError("transaction amount must be a positive numeric value");
    }

    switch (transaction.kind) {
      case "income":
        incomeCents = addSafeCents(incomeCents, amountCents);
        break;
      case "expense": {
        if (!transaction.category) {
          throw new TypeError("expense transaction must have a category");
        }
        expenseCents = addSafeCents(expenseCents, amountCents);
        expenses.set(
          transaction.category,
          addSafeCents(expenses.get(transaction.category) ?? 0, amountCents),
        );
        break;
      }
      case "contribution":
        contributionCents = addSafeCents(contributionCents, amountCents);
        break;
    }
  }

  const balanceCents = incomeCents - expenseCents - contributionCents;
  if (!Number.isSafeInteger(balanceCents)) {
    throw new RangeError("transaction balance exceeds the safe integer range");
  }

  const expensesByCategory = Array.from(
    expenses,
    ([category, totalCents]) => ({ category, totalCents }),
  ).sort(
    (left, right) =>
      right.totalCents - left.totalCents ||
      (categoryOrder.get(left.category) ?? 0) -
        (categoryOrder.get(right.category) ?? 0),
  );

  return {
    incomeCents,
    expenseCents,
    contributionCents,
    balanceCents,
    expensesByCategory,
  };
}

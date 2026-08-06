export const TRANSACTION_KINDS = [
  "expense",
  "income",
  "contribution",
] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type EntryTransactionKind = Exclude<TransactionKind, "contribution">;

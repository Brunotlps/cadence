import {
  isValidCivilDate,
  isValidMonth,
} from "@/lib/transactions/civil-date";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const civilDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrencyBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("cents must be a safe integer");
  }

  return currencyFormatter.format(cents / 100);
}

export function formatCivilDatePtBR(value: string): string {
  if (!isValidCivilDate(value)) throw new RangeError("invalid civil date");
  return civilDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export function formatMonthPtBR(value: string): string {
  if (!isValidMonth(value)) throw new RangeError("invalid month");
  return monthFormatter.format(new Date(`${value}-01T00:00:00.000Z`));
}

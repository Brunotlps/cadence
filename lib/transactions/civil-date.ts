const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;

  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function getTodayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftMonth(month: string, offset: number): string {
  if (!isValidMonth(month)) throw new RangeError("invalid month");
  if (!Number.isInteger(offset)) throw new TypeError("offset must be an integer");

  const [year, monthNumber] = month.split("-").map(Number);
  const absoluteMonth = year * 12 + monthNumber - 1 + offset;
  const shiftedYear = Math.floor(absoluteMonth / 12);
  const shiftedMonth = ((absoluteMonth % 12) + 12) % 12;

  if (shiftedYear < 0 || shiftedYear > 9999) {
    throw new RangeError("shifted month is outside the supported range");
  }

  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth + 1).padStart(2, "0")}`;
}

export function getMonthRange(month: string): {
  start: string;
  endExclusive: string;
} {
  if (!isValidMonth(month)) throw new RangeError("invalid month");

  return {
    start: `${month}-01`,
    endExclusive: `${shiftMonth(month, 1)}-01`,
  };
}

export function resolveMonth(
  value: string | string[] | undefined,
  now: Date = new Date(),
): string {
  if (typeof value === "string" && isValidMonth(value)) return value;
  return getTodayInSaoPaulo(now).slice(0, 7);
}

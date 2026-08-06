function amountParts(input: string): { whole: string; fraction: string } | null {
  if (/^\d+$/.test(input)) {
    return { whole: input, fraction: "" };
  }

  if (input.includes(",") && input.includes(".")) {
    if (!/^\d{1,3}(?:\.\d{3})*,\d{1,2}$/.test(input)) return null;
    const [whole, fraction] = input.split(",");
    return { whole: whole.replaceAll(".", ""), fraction };
  }

  if (input.includes(",")) {
    if (!/^\d+,\d{1,2}$/.test(input)) return null;
    const [whole, fraction] = input.split(",");
    return { whole, fraction };
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(input)) {
    return { whole: input.replaceAll(".", ""), fraction: "" };
  }

  if (/^\d+\.\d{1,2}$/.test(input)) {
    const [whole, fraction] = input.split(".");
    return { whole, fraction };
  }

  return null;
}

// Interpreta entrada pt-BR (vírgula decimal e ponto de milhar) e também o ponto
// decimal emitido por inputs HTML. A conversão usa BigInt internamente para nunca
// arredondar antes de chegar a centavos.
export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (!unsigned) return null;

  const parts = amountParts(unsigned);
  if (!parts) return null;

  const fraction = parts.fraction.padEnd(2, "0");
  const absoluteCents =
    BigInt(parts.whole) * BigInt(100) + BigInt(fraction || "0");
  const signedCents = negative ? -absoluteCents : absoluteCents;

  if (
    signedCents > BigInt(Number.MAX_SAFE_INTEGER) ||
    signedCents < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return null;
  }

  return Number(signedCents);
}

export function centsToNumeric(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("cents must be a safe integer");
  }

  const negative = cents < 0;
  const absoluteCents = Math.abs(cents);
  const whole = Math.floor(absoluteCents / 100);
  const fraction = String(absoluteCents % 100).padStart(2, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

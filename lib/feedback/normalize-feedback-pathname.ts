const STATIC_PROTECTED_PATHS = new Set([
  "/dashboard",
  "/goals",
  "/fixed-bills",
  "/account",
  "/workspace/invite",
  "/onboarding/workspace",
]);

const DYNAMIC_PROTECTED_PATHS: Array<[RegExp, string]> = [
  [/^\/transactions\/[^/]+\/edit$/, "/transactions/[id]/edit"],
  [/^\/goals\/[^/]+\/edit$/, "/goals/[id]/edit"],
  [/^\/contributions\/[^/]+\/edit$/, "/contributions/[id]/edit"],
  [/^\/fixed-bills\/[^/]+\/edit$/, "/fixed-bills/[id]/edit"],
  [/^\/bill-payments\/[^/]+\/edit$/, "/bill-payments/[id]/edit"],
  [/^\/join\/[^/]+$/, "/join/[token]"],
];

// O pathname é contexto opcional. Qualquer URL, query, fragmento, identificador
// ou rota fora da lista protegida é descartado antes de chegar à entrega.
export function normalizeFeedbackPathname(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.includes("?") || value.includes("#")) {
    return null;
  }

  if (STATIC_PROTECTED_PATHS.has(value)) return value;

  for (const [pattern, template] of DYNAMIC_PROTECTED_PATHS) {
    if (pattern.test(value)) return template;
  }

  return null;
}

import type { EntryTransactionKind } from "./kinds";

export const TRANSACTION_CATEGORIES = [
  { code: "alimentacao", label: "Alimentação" },
  { code: "aluguel", label: "Aluguel" },
  { code: "assinaturas", label: "Assinaturas" },
  { code: "automoveis", label: "Automóveis" },
  { code: "combustivel", label: "Combustível" },
  { code: "condominio", label: "Condomínio" },
  { code: "internet", label: "Internet" },
  { code: "lazer", label: "Lazer" },
  { code: "luz", label: "Luz" },
  { code: "renda", label: "Renda" },
  { code: "saude", label: "Saúde" },
] as const satisfies ReadonlyArray<{ code: string; label: string }>;

export type TransactionCategoryCode =
  (typeof TRANSACTION_CATEGORIES)[number]["code"];

// A Etapa 06 não expõe campo de tipo: Renda é a única categoria de receita;
// todas as outras são despesas. Aportes continuam no schema, mas fora deste fluxo.
export function deriveTransactionKind(
  category: TransactionCategoryCode,
): EntryTransactionKind {
  return category === "renda" ? "income" : "expense";
}

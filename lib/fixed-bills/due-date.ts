import { isValidCivilDate, isValidMonth } from "@/lib/transactions/civil-date";

// Janela do aviso visual da decisão 8. Só destaque na interface — nenhuma
// notificação, e-mail ou agendamento depende deste valor.
export const DUE_SOON_WINDOW_DAYS = 5;

const MIN_DUE_DAY = 1;
const MAX_DUE_DAY = 31;
const MILLISECONDS_PER_DAY = 86_400_000;

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Dia fixo mapeado para o mês civil, preso ao último dia em meses curtos: uma conta
// que vence dia 31 vence em 28/29 de fevereiro e em 30 de abril. Mesmo ajuste de
// aniversário mensal já usado no ritmo das metas.
export function resolveDueDate(dueDay: number, month: string): string {
  if (
    !Number.isInteger(dueDay) ||
    dueDay < MIN_DUE_DAY ||
    dueDay > MAX_DUE_DAY
  ) {
    throw new RangeError("dueDay must be an integer between 1 and 31");
  }
  if (!isValidMonth(month)) throw new RangeError("invalid month");

  const [year, monthNumber] = month.split("-").map(Number);
  const day = Math.min(dueDay, lastDayOfMonth(year, monthNumber));

  return `${month}-${String(day).padStart(2, "0")}`;
}

// Diferença com sinal entre duas datas civis. Ambas são ancoradas em meia-noite UTC,
// então o resultado nunca depende do fuso do servidor nem de horário de verão.
export function countCivilDaysBetween(from: string, to: string): number {
  if (!isValidCivilDate(from) || !isValidCivilDate(to)) {
    throw new RangeError("civil dates must use the YYYY-MM-DD format");
  }

  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);

  return (toTime - fromTime) / MILLISECONDS_PER_DAY;
}

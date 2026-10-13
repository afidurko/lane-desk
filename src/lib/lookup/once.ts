export type OnceRow = { s: string; t: string; c: number; n: string };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function quarterOfPeriod(text: string) {
  const lower = text.toLowerCase();
  const index = MONTHS.findIndex((month) => lower.includes(month));
  if (index < 0) return null;
  return Math.floor(index / 3) + 1;
}

/** A month keeps the quarter that covers it. An October file is not used for March. */
export function pickOnce(rows: OnceRow[] | undefined, year: number | null, month: number | null = null) {
  if (!rows || year === null) return null;
  const inYear = rows.filter((row) => row.t.includes(String(year)));
  if (month === null || month < 1 || month > 12) return inYear[0] ?? null;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const named = inYear.filter((row) => quarterOfPeriod(row.t) !== null);
  if (named.length === 0) return inYear[0] ?? null;
  return named.find((row) => quarterOfPeriod(row.t) === quarter) ?? null;
}

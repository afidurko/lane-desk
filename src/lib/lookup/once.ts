export type OnceRow = { s: string; t: string; c: number; n: string };

export function pickOnce(rows: OnceRow[] | undefined, year: number | null) {
  if (!rows || year === null) return null;
  return rows.find((row) => row.t.includes(String(year))) ?? null;
}

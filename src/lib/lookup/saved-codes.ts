export type SavedRow = {
  type: string;
  c: string;
  name: string;
  cents: number | null;
  otherCents?: number | null;
  year: number | null;
  months: number[] | null;
  asOf: string;
  note?: string;
  place?: string;
};

export function pickSaved(rows: SavedRow[], code: string, year: number | null, month: number | null) {
  const hits = rows.filter((row) => {
    if (row.c !== code || row.cents === null || row.year === null || row.year !== year) return false;
    if (row.months && (month === null || !row.months.includes(month))) return false;
    return true;
  });
  if (hits.length !== 1) return null;
  return hits[0];
}

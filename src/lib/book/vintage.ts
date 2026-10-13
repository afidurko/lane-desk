export const QUARTER = { start: "2026-10-01", end: "2026-12-31", label: "October 1 through December 31, 2026" };
export const FISCAL = { start: "2026-10-01", end: "2027-09-30", label: "October 1, 2026 through September 30, 2027" };

export function dateFits(date: string, start: string, end: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date <= end;
}

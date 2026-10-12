/** Medicare county amounts already checked in this project. Not a Medicaid rate. */

export const RATE_SOURCE =
  "CMS MA/PACE ratebook rows already checked in this project. Monroe, Erie, and Albany were one grouped row. Cattaraugus is not in those rows. A Medicaid PACE rate is not public.";

export const MEDICARE_AB: { county: string; year: number; cents: number }[] = [
  { county: "New York", year: 2026, cents: 198361 },
  { county: "Kings", year: 2026, cents: 180485 },
  { county: "Monroe", year: 2026, cents: 139641 },
  { county: "Erie", year: 2026, cents: 139641 },
  { county: "Albany", year: 2026, cents: 139641 },
  { county: "New York", year: 2027, cents: 205376 },
];

export const ESRD_CENTS = { 2026: 1205155 } as const;
export const PART_D_BID = { 2026: 23927 } as const;

export const COUNTIES = ["Cattaraugus", "Allegany", "Erie", "Monroe", "Albany", "New York", "Kings"] as const;

export function medicareCents(county: string, year: number, esrd: boolean) {
  if (esrd) return ESRD_CENTS[year as keyof typeof ESRD_CENTS] ?? null;
  return MEDICARE_AB.find((row) => row.county === county && row.year === year)?.cents ?? null;
}

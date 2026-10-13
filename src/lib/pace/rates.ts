/** Medicare county amounts from the CMS 2026 MA rate book, CountyRate2026PACE.csv. Not a Medicaid rate. */

export const RATE_SOURCE =
  "CMS 2026 MA rate book, CountyRate2026PACE.csv. These are the Parts A and B monthly amounts for PACE plans. Cattaraugus and Allegany are both $1,263.49. ESRD is the dialysis rate in that file. It replaces the county amount. A Medicaid PACE rate is not public.";

export const MEDICARE_AB: { county: string; year: number; cents: number }[] = [
  { county: "Cattaraugus", year: 2026, cents: 126349 },
  { county: "Allegany", year: 2026, cents: 126349 },
  { county: "Albany", year: 2026, cents: 139641 },
  { county: "Bronx", year: 2026, cents: 192715 },
  { county: "Broome", year: 2026, cents: 139641 },
  { county: "Cayuga", year: 2026, cents: 139641 },
  { county: "Chautauqua", year: 2026, cents: 126349 },
  { county: "Chemung", year: 2026, cents: 126349 },
  { county: "Chenango", year: 2026, cents: 126349 },
  { county: "Clinton", year: 2026, cents: 129815 },
  { county: "Columbia", year: 2026, cents: 127963 },
  { county: "Cortland", year: 2026, cents: 126349 },
  { county: "Delaware", year: 2026, cents: 137708 },
  { county: "Dutchess", year: 2026, cents: 139641 },
  { county: "Erie", year: 2026, cents: 139641 },
  { county: "Essex", year: 2026, cents: 132872 },
  { county: "Franklin", year: 2026, cents: 126349 },
  { county: "Fulton", year: 2026, cents: 126349 },
  { county: "Genesee", year: 2026, cents: 139641 },
  { county: "Greene", year: 2026, cents: 127347 },
  { county: "Hamilton", year: 2026, cents: 126349 },
  { county: "Herkimer", year: 2026, cents: 139641 },
  { county: "Jefferson", year: 2026, cents: 128304 },
  { county: "Kings", year: 2026, cents: 180485 },
  { county: "Lewis", year: 2026, cents: 126349 },
  { county: "Livingston", year: 2026, cents: 139641 },
  { county: "Madison", year: 2026, cents: 139641 },
  { county: "Monroe", year: 2026, cents: 139641 },
  { county: "Montgomery", year: 2026, cents: 139641 },
  { county: "Nassau", year: 2026, cents: 168992 },
  { county: "New York", year: 2026, cents: 198361 },
  { county: "Niagara", year: 2026, cents: 139641 },
  { county: "Oneida", year: 2026, cents: 139641 },
  { county: "Onondaga", year: 2026, cents: 139641 },
  { county: "Ontario", year: 2026, cents: 139641 },
  { county: "Orange", year: 2026, cents: 145179 },
  { county: "Orleans", year: 2026, cents: 139641 },
  { county: "Oswego", year: 2026, cents: 139641 },
  { county: "Otsego", year: 2026, cents: 135667 },
  { county: "Putnam", year: 2026, cents: 154701 },
  { county: "Queens", year: 2026, cents: 173142 },
  { county: "Rensselaer", year: 2026, cents: 139641 },
  { county: "Richmond", year: 2026, cents: 186574 },
  { county: "Rockland", year: 2026, cents: 155438 },
  { county: "Saratoga", year: 2026, cents: 139641 },
  { county: "Schenectady", year: 2026, cents: 139641 },
  { county: "Schoharie", year: 2026, cents: 139641 },
  { county: "Schuyler", year: 2026, cents: 128236 },
  { county: "Seneca", year: 2026, cents: 126349 },
  { county: "St. Lawrence", year: 2026, cents: 126349 },
  { county: "Steuben", year: 2026, cents: 126349 },
  { county: "Suffolk", year: 2026, cents: 158842 },
  { county: "Sullivan", year: 2026, cents: 128206 },
  { county: "Tioga", year: 2026, cents: 139641 },
  { county: "Tompkins", year: 2026, cents: 126349 },
  { county: "Ulster", year: 2026, cents: 134389 },
  { county: "Warren", year: 2026, cents: 126349 },
  { county: "Washington", year: 2026, cents: 126349 },
  { county: "Wayne", year: 2026, cents: 139641 },
  { county: "Westchester", year: 2026, cents: 158081 },
  { county: "Wyoming", year: 2026, cents: 126349 },
  { county: "Yates", year: 2026, cents: 126349 },
];

export const ESRD_CENTS = { 2026: 1205155 } as const;
export const PART_D_BID = { 2026: 23927 } as const;

export const COUNTIES = ["Cattaraugus", "Allegany", "Albany", "Bronx", "Broome", "Cayuga", "Chautauqua", "Chemung", "Chenango", "Clinton", "Columbia", "Cortland", "Delaware", "Dutchess", "Erie", "Essex", "Franklin", "Fulton", "Genesee", "Greene", "Hamilton", "Herkimer", "Jefferson", "Kings", "Lewis", "Livingston", "Madison", "Monroe", "Montgomery", "Nassau", "New York", "Niagara", "Oneida", "Onondaga", "Ontario", "Orange", "Orleans", "Oswego", "Otsego", "Putnam", "Queens", "Rensselaer", "Richmond", "Rockland", "Saratoga", "Schenectady", "Schoharie", "Schuyler", "Seneca", "St. Lawrence", "Steuben", "Suffolk", "Sullivan", "Tioga", "Tompkins", "Ulster", "Warren", "Washington", "Wayne", "Westchester", "Wyoming", "Yates"] as const;

export function medicareCents(county: string, year: number, esrd: boolean) {
  if (esrd) return ESRD_CENTS[year as keyof typeof ESRD_CENTS] ?? null;
  return MEDICARE_AB.find((row) => row.county === county && row.year === year)?.cents ?? null;
}

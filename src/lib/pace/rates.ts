import { OFFICIAL as official } from "@/lib/pace/official";
import { money } from "@/lib/desk/clock";

/**
 * PACE month figures, all read from src/lib/pace/official.ts, which scripts/build-pace-rates.py writes from the
 * checked CMS index files (pace_history.sqlite for PACE; ma_partd_ny.sqlite for Part D). No amount is typed here.
 * Internal only: this module is imported by the PACE screen alone, and a public build ships only its gate stub.
 * A county or year that is not in those files has no amount and is marked NOT_CHECKED. Nothing is estimated.
 */

export type Sourced = { cents: number; source: string; year: number };

export const NOT_CHECKED = "not yet checked against CMS";

export const RATE_SOURCE =
  "PACE rates are the CMS PACE ratebook (not the regular Medicare Advantage rates). Each amount names its CMS file and year. A Medicaid PACE rate is not public.";

/** All 62 New York counties in the PACE ratebook, from official.ts. */
export const COUNTIES: readonly string[] = official.counties;

/** Years the screen offers. Each reads that year's PACE file. */
export const PACE_YEARS: readonly number[] = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export function isPaceYear(year: number) {
  return PACE_YEARS.includes(year);
}

type Table = Record<string, Record<string, { cents: number; source: string }>>;

function pick(table: Table, year: number, county: string): Sourced | null {
  const row = table[String(year)]?.[county];
  return row ? { cents: row.cents, source: row.source, year } : null;
}

/**
 * 2020 NY PACE ESRD: CMS revised it on 2020-10-02 ($8,651.11; the original was $8,234.99). This one value picks which
 * the screen and month total use. Flip to "original" if Takeover decides so.
 */
export const ESRD_2020_USE: "revised" | "original" = "revised";
/** The original (pre-revision) 2020 NY PACE ESRD rate, read from the 2020 PACE ratebook in official.ts. */
export const ESRD_2020_ORIGINAL_CENTS: number | null = Object.values((official.paceEsrd as Table)["2020"] ?? {})[0]?.cents ?? null;
export const ESRD_2020_NOTE =
  ESRD_2020_USE === "revised"
    ? `CMS revised the 2020 PACE ESRD rate on Oct 2, 2020. This screen uses the revised rate. The original was ${ESRD_2020_ORIGINAL_CENTS === null ? `unpriced, ${NOT_CHECKED}` : money(ESRD_2020_ORIGINAL_CENTS / 100)}.`
    : `CMS revised the 2020 PACE ESRD rate on Oct 2, 2020. This screen uses the original rate.`;

function esrdTable(year: number): Table {
  return (year === 2020 && ESRD_2020_USE === "revised" ? official.paceEsrdRevised : official.paceEsrd) as Table;
}

/** PACE Parts A/B monthly base county rate (risk), or the PACE ESRD rate. ESRD comes from the PACE ratebook only, never the MA file. */
export function paceRate(county: string, year: number, esrd: boolean): Sourced | null {
  return pick(esrd ? esrdTable(year) : (official.pace as Table), year, county);
}

/** NY PACE ESRD rate for the year (the same on every NY county row), from the PACE ratebook only. */
export function paceEsrd(year: number): Sourced | null {
  const rows = esrdTable(year)[String(year)];
  const first = rows ? Object.values(rows)[0] : undefined;
  return first ? { cents: first.cents, source: first.source, year } : null;
}

export const BASE_RATE_NOTE =
  "These are base county rates, before CMS adjusts them for each person's health (risk score) and frailty.";

export function partD(year: number): { bid: Sourced; premium: Sourced } | null {
  const row = (official.partD as Record<string, { bidCents: number; premiumCents: number; source: string }>)[String(year)];
  return row ? { bid: { cents: row.bidCents, source: row.source, year }, premium: { cents: row.premiumCents, source: row.source, year } } : null;
}

/** The Medicare amount the month total uses: the PACE county rate, or the PACE ESRD rate. Null when not in the files. */
export function medicareCents(county: string, year: number, esrd: boolean) {
  return paceRate(county, year, esrd)?.cents ?? null;
}

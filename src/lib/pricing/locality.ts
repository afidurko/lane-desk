import { conversionFor, localityDollars, reducedDollars, type Locality, type PfsFile, type PfsRow } from "@/lib/book/price";
import { keyOf, nyLocalities } from "@/lib/config/ny";
import type { MpprInfo } from "@/lib/pricing/national";

const PAYABLE = new Set(["A", "R", "T"]);

export type LocalityPrices = {
  place: Locality;
  /** code -> non-facility dollars per unit, for the codes CMS prices for the office. */
  rates: Record<string, number>;
  mppr: Record<string, MpprInfo>;
  /** Payable codes with CMS non-facility NA: no office price. */
  notOffice: Set<string>;
  localities: Locality[];
};

/**
 * One New York locality out of a full year file, non-facility, non-QP.
 * Pure: no fetch and no mode flag, so the checks can run it on the files on disk.
 */
export function localityPrices(file: PfsFile, localityKey: string): LocalityPrices {
  const ny = nyLocalities(file.localities);
  const place = ny.find((item) => keyOf(item) === localityKey);
  if (!place) throw new Error("That New York locality is not in the loaded file.");
  const rates: Record<string, number> = {};
  const mppr: Record<string, MpprInfo> = {};
  const notOffice = new Set<string>();
  for (const row of file.rows as PfsRow[]) {
    if (row.m !== "") continue;
    // Only statuses CMS pays: active, restricted, and therapy. A bundled code has RVUs in the file but no separate payment.
    if (!PAYABLE.has(row.s)) continue;
    const conversion = conversionFor(row, "nonQp", file);
    if (!conversion) continue;
    if (row.nn && (row.s === "A" || row.s === "R" || row.s === "T")) {
      notOffice.add(row.c);
      continue;
    }
    const dollars = localityDollars(row, "nf", place, conversion);
    if (dollars <= 0) continue;
    rates[row.c] = dollars;
    if (row.mu) {
      mppr[row.c] = {
        pe: row.pn,
        fullCents: Math.round(dollars * 100),
        reducedCents: Math.round(reducedDollars(row, place, conversion) * 100),
      };
    }
  }
  return { place, rates, mppr, notOffice, localities: ny };
}

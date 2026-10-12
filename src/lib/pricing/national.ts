import { dollarsFromTotal, type PfsFile, type PfsRow } from "@/lib/book/price";

/**
 * National 2026 Medicare physician fee schedule, non-facility, non-QP.
 * Every amount here is the file's own non-facility total times the file's conversion factor.
 * Nothing is typed in by hand. Rows with a modifier are skipped, as in the year files.
 */
export type NationalRow = { n: string; a: Record<string, number | null>; s: string };

export type National = {
  release: string;
  year: number;
  conversion: string;
  rows: Map<string, NationalRow>;
};

const PAYABLE = new Set(["A", "R", "T"]);

export function nationalCents(row: Pick<PfsRow, "s" | "tn">, conversion: string): number | null {
  if (!PAYABLE.has(row.s)) return null;
  const dollars = dollarsFromTotal(row.tn, conversion);
  return dollars > 0 ? Math.round(dollars * 100) : null;
}

export function indexNational(file: PfsFile): National {
  const conversion = file.conversion.nonQp;
  const rows = new Map<string, NationalRow>();
  for (const row of file.rows) {
    if (row.m !== "") continue;
    rows.set(row.c.toUpperCase(), {
      n: row.d,
      s: row.s,
      a: { [String(file.year)]: nationalCents(row, conversion) },
    });
  }
  return { release: file.release, year: file.year, conversion, rows };
}

let pending: Promise<National> | null = null;

export function loadNational(): Promise<National> {
  if (!pending) {
    pending = fetch("/pfs-2026.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("The 2026 national file did not load.");
        return indexNational((await response.json()) as PfsFile);
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** code -> dollars, for the therapy clock. Only codes the file pays. */
export function ratesOf(national: National): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [code, row] of national.rows) {
    const cents = row.a[String(national.year)];
    if (typeof cents === "number") rates[code] = cents / 100;
  }
  return rates;
}

import { dollarsFromTotal, reducedDollars, type PfsFile, type PfsRow } from "@/lib/book/price";

/**
 * National 2026 Medicare physician fee schedule, non-facility, non-QP.
 * Every amount here is the file's own non-facility total times the file's conversion factor.
 * Nothing is typed in by hand. Rows with a modifier are skipped, as in the year files.
 *
 * A code CMS marks non-facility NA ("rarely or never performed in the office setting") has no office price here.
 * The file copies the facility value into the office column for those codes. It is not shown as an office price.
 */
export type NationalRow = {
  /** Short name. Empty from the public file: CMS short names are CPT text and are not shipped publicly. */
  n: string;
  a: Record<string, number | null>;
  s: string;
  /** No office price: CMS non-facility NA. */ nn?: true;
};

/** What the therapy multiple-procedure reduction needs for one code. */
export type MpprInfo = { pe: number; fullCents: number; reducedCents: number };

export type National = {
  release: string;
  year: number;
  conversion: string;
  rows: Map<string, NationalRow>;
  mppr: Record<string, MpprInfo>;
};

/** What the national indexer needs. The public file carries only this; the full file also fits. */
export type NationalFile = Pick<PfsFile, "release" | "year" | "conversion"> & {
  rows: (Pick<PfsRow, "c" | "m" | "s" | "tn"> & Partial<Pick<PfsRow, "d" | "w" | "pn" | "mp" | "mu" | "nn">>)[];
};

const PAYABLE = new Set(["A", "R", "T"]);

export function nationalCents(row: Pick<PfsRow, "s" | "tn"> & { nn?: 1 }, conversion: string): number | null {
  if (!PAYABLE.has(row.s) || row.nn) return null;
  const dollars = dollarsFromTotal(row.tn, conversion);
  return dollars > 0 ? Math.round(dollars * 100) : null;
}

export function indexNational(file: NationalFile): National {
  const conversion = file.conversion.nonQp;
  const rows = new Map<string, NationalRow>();
  const mppr: Record<string, MpprInfo> = {};
  for (const row of file.rows) {
    if (row.m !== "") continue;
    const code = row.c.toUpperCase();
    const cents = nationalCents(row, conversion);
    rows.set(code, {
      n: row.d ?? "",
      s: row.s,
      a: { [String(file.year)]: cents },
      ...(row.nn && PAYABLE.has(row.s) ? { nn: true as const } : {}),
    });
    if (row.mu && cents !== null && row.w !== undefined && row.pn !== undefined && row.mp !== undefined) {
      const reduced = reducedDollars(row as PfsRow, null, conversion);
      mppr[code] = { pe: row.pn, fullCents: cents, reducedCents: Math.round(reduced * 100) };
    }
  }
  return { release: file.release, year: file.year, conversion, rows, mppr };
}

let pending: Promise<National> | null = null;

export function loadNational(): Promise<National> {
  if (!pending) {
    pending = fetch("/pfs-national-2026.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("The 2026 national file did not load.");
        return indexNational((await response.json()) as NationalFile);
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** code -> dollars, for the therapy clock. Only codes the file pays and prices for the office. */
export function ratesOf(national: National): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [code, row] of national.rows) {
    const cents = row.a[String(national.year)];
    if (typeof cents === "number") rates[code] = cents / 100;
  }
  return rates;
}

/** Payable codes CMS gives no office price. */
export function notOfficeOf(national: National): Set<string> {
  const out = new Set<string>();
  for (const [code, row] of national.rows) if (row.nn) out.add(code);
  return out;
}

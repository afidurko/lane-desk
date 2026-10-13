export type PfsRow = {
  c: string;
  m: string;
  d: string;
  s: string;
  w: number;
  pn: number;
  pf: number;
  mp: number;
  tn: number;
  tf: number;
  q?: string;
  /** CMS MULT PROC indicator 5: therapy multiple-procedure payment reduction applies. */
  mu?: "5";
  /** CMS non-facility PE indicator NA: rarely or never done in the office, so no office price. */
  nn?: 1;
  /** CMS facility PE indicator NA. */
  fn?: 1;
};

export type Locality = {
  mac: string;
  state: string;
  number: string;
  name: string;
  work: number;
  pe: number;
  mp: number;
};

export type PfsFile = {
  release: string;
  posted: string;
  year: number;
  gpci: string;
  conversion: { nonQp: string; qp: string | null };
  source: string;
  anesthesiaHeader?: string[];
  anesthesia?: { mac: string; number: string; name: string; rates: string[] }[];
  localities: Locality[];
  rows: PfsRow[];
};

/** The words every screen uses for a CMS non-facility NA code. */
export const NOT_OFFICE_LABEL = "Not priced in the office setting";

/**
 * Same rule as the desk (locality.ts): a payable code (status A, R or T) with CMS non-facility NA has no office price.
 * 4,043 base codes on the 2026 file.
 */
export function notPricedInOffice(row: Pick<PfsRow, "nn" | "s">) {
  return Boolean(row.nn) && (row.s === "A" || row.s === "R" || row.s === "T");
}

/** The words every screen uses for a code Medicare does not pay separately (status B, I, N, X and the like). */
export const NOT_PAID_LABEL = "Medicare does not pay this code separately";

/** Medicare pays a separate physician amount only for status A, R or T. B, C, E, I, J, M, N, P, X get no dollar amount. */
export function payableStatus(status: string) {
  return status === "A" || status === "R" || status === "T";
}

/**
 * The one rule every screen uses before it shows a dollar amount (Filter, Book, desk file scan, /history):
 * no amount for a code Medicare does not pay (non-payable status), and no office (non-facility) amount for a code
 * with CMS non-facility NA.
 */
export function noDollarAmount(row: Pick<PfsRow, "nn" | "s">, setting: "nf" | "fac" = "nf") {
  if (!payableStatus(row.s)) return true;
  return setting === "nf" && notPricedInOffice(row);
}

export const SEQUESTRATION = {
  percent: 2,
  carc: "253",
  since: "2013-04-01",
  source:
    "The fee schedule amount is not reduced. The cut applies to the Medicare payment after deductible and coinsurance, CARC 253. It was 2 percent before May 1, 2020, suspended through March 31, 2022, 1 percent from April 1 through June 30, 2022, and 2 percent on or after July 1, 2022.",
} as const;

export function dollarsFromTotal(total: number, conversion: string) {
  return Math.round(total * Number(conversion) * 100 + 1e-9) / 100;
}

export function localityDollars(row: PfsRow, setting: "nf" | "fac", locality: Locality | null, conversion: string) {
  if (!locality) {
    return dollarsFromTotal(setting === "nf" ? row.tn : row.tf, conversion);
  }
  const practice = setting === "nf" ? row.pn : row.pf;
  const total = row.w * locality.work + practice * locality.pe + row.mp * locality.mp;
  return Math.round(total * Number(conversion) * 100 + 1e-9) / 100;
}

/**
 * Therapy multiple-procedure payment reduction (MPPR). The practice-expense part of every therapy unit after the
 * first (highest practice-expense) unit is cut by half. Work and malpractice are not cut.
 * Same rounding as localityDollars.
 */
export function reducedDollars(row: PfsRow, locality: Locality | null, conversion: string) {
  const work = locality?.work ?? 1;
  const practice = locality?.pe ?? 1;
  const malpractice = locality?.mp ?? 1;
  const total = row.w * work + row.pn * 0.5 * practice + row.mp * malpractice;
  return Math.round(total * Number(conversion) * 100 + 1e-9) / 100;
}

export function conversionFor(row: PfsRow, clinician: "nonQp" | "qp", file: PfsFile) {
  if (clinician === "nonQp") return file.conversion.nonQp;
  return row.q ?? null;
}

export function sequestrationPercent(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (date < "2020-05-01") return 2;
  if (date < "2022-04-01") return 0;
  if (date < "2022-07-01") return 1;
  return 2;
}

export function sequestrationLabel(date: string) {
  const percent = sequestrationPercent(date);
  if (percent === null) return "Enter a date of service.";
  if (percent === 0) return "Suspended for dates of service May 1, 2020 through March 31, 2022.";
  if (percent === 1) return "1 percent for dates of service April 1, 2022 through June 30, 2022.";
  if (date < "2020-05-01") return "2 percent for dates of service before May 1, 2020.";
  return "2 percent for dates of service on or after July 1, 2022.";
}

/** Part B illustration. Deductible is treated as already met. Not a payment. */
export function sequester(allowed: number, percent = 2) {
  const medicare = Math.round(allowed * 80) / 100;
  const cut = Math.round(medicare * percent) / 100;
  const paid = Math.round((medicare - cut) * 100) / 100;
  const coinsurance = Math.round((allowed - medicare) * 100) / 100;
  return { medicare, cut, paid, coinsurance };
}

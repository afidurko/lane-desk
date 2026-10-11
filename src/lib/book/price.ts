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

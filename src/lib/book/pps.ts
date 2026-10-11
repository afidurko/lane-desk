export type AspRow = { c: string; name: string; dose: string; cents: number | null };
export type OppsRow = { c: string; name: string; si: string; apc: string; cents: number | null };
export type AscRow = { c: string; name: string; indicator: string; cents: number | null; list: string };
export type DrgRow = { drg: string; title: string; weight: string };
export type BaseRate = { name: string; cents: number | null; note: string };

export type PpsFile = {
  asp: { asOf: string; source: string; rows: AspRow[] };
  opps: { asOf: string; source: string; rows: OppsRow[] };
  asc: { asOf: string; source: string; rows: AscRow[] };
  ipps: {
    asOf: string;
    source: string;
    laborAboveOne: number;
    nonlaborAboveOne: number;
    laborAtOrBelowOne: number;
    nonlaborAtOrBelowOne: number;
    rows: DrgRow[];
  };
  bases: BaseRate[];
};

export function findPps(file: PpsFile, query: string) {
  const code = query.trim().toUpperCase();
  return {
    asp: file.asp.rows.filter((row) => row.c === code),
    opps: file.opps.rows.filter((row) => row.c === code),
    asc: file.asc.rows.filter((row) => row.c === code),
    drg: /^\d{3}$/.test(code) ? file.ipps.rows.filter((row) => row.drg === code) : [],
  };
}

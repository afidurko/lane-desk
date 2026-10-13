export type Lookup = {
  c: string;
  status: "known" | "unknown";
  cents: number | null;
  at: string;
  year: number | null;
  months: number[] | null;
  asOf: string;
  related: string[];
  note?: string;
};

/** Oldest lookups go first. A full store keeps the newest. */
export function dropOldest<T extends { at: string }>(rows: T[], cap: number) {
  const ordered = [...rows].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return ordered.slice(Math.max(0, ordered.length - cap));
}

export function answerFor(rows: Lookup[], code: string, year: number | null, month: number | null) {
  const hits = rows.filter((row) => {
    if (row.c !== code) return false;
    if (row.year !== null && row.year !== year) return false;
    if (row.months && (month === null || !row.months.includes(month))) return false;
    return true;
  });
  if (hits.length !== 1) return null;
  const hit = hits[0];
  if (hit.status !== "known" || hit.cents === null || !Number.isInteger(hit.cents) || hit.cents <= 0) return { ...hit, payable: null as number | null };
  return { ...hit, payable: hit.cents };
}

const KEY = "lane-lookups";

export function readLookups(): Lookup[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLookup);
  } catch {
    return [];
  }
}

export function rememberLookups(rows: Lookup[], cap = 40) {
  if (typeof window === "undefined" || rows.length === 0) return;
  const merged = new Map(readLookups().map((row) => [`${row.c}|${row.year}`, row]));
  for (const row of rows) merged.set(`${row.c}|${row.year}`, { ...row, at: row.at || new Date().toISOString() });
  window.localStorage.setItem(KEY, JSON.stringify(dropOldest([...merged.values()], cap)));
}

function isLookup(value: unknown): value is Lookup {
  if (!value || typeof value !== "object") return false;
  const row = value as Lookup;
  return typeof row.c === "string" && (row.status === "known" || row.status === "unknown") && typeof row.at === "string";
}

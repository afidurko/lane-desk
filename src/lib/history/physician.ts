import { conversionFor, localityDollars, noDollarAmount, type PfsFile } from "@/lib/book/price";

/** One /history row: first priced year against last priced year, Rest of New York, non-facility, non-QP. Cents. */
export type HistoryMove = { c: string; n: string; from: number; fc: number; to: number; tc: number; d: number };

const MAC = "13282";
const LOC = "99";

/**
 * Rest of New York office amount in cents, or null. Uses the shared rule (noDollarAmount): a non-payable status or a
 * CMS non-facility NA code has no office amount, so it never enters /history.
 */
export function officeCents(file: PfsFile, row: PfsFile["rows"][number]) {
  if (noDollarAmount(row, "nf")) return null;
  const locality = file.localities.find((item) => item.mac === MAC && item.number === LOC) ?? null;
  const conversion = conversionFor(row, "nonQp", file);
  if (!conversion) return null;
  const dollars = localityDollars(row, "nf", locality, conversion);
  return dollars > 0 ? Math.round(dollars * 100) : null;
}

export function physicianHistory(files: PfsFile[], options: { ignoreNoDollarRule?: boolean } = {}) {
  const per = new Map<string, { name: string; years: Map<number, number> }>();
  const codes = new Set<string>();
  for (const file of [...files].sort((a, b) => a.year - b.year)) {
    const locality = file.localities.find((item) => item.mac === MAC && item.number === LOC) ?? null;
    for (const row of file.rows) {
      if (row.m !== "") continue;
      codes.add(row.c);
      let cents: number | null;
      if (options.ignoreNoDollarRule) {
        const conversion = conversionFor(row, "nonQp", file);
        const dollars = conversion && (row.s === "A" || row.s === "R" || row.s === "T") ? localityDollars(row, "nf", locality, conversion) : 0;
        cents = dollars > 0 ? Math.round(dollars * 100) : null;
      } else {
        cents = officeCents(file, row);
      }
      const entry = per.get(row.c) ?? { name: row.d, years: new Map() };
      if (row.d) entry.name = row.d;
      if (cents !== null) entry.years.set(file.year, cents);
      per.set(row.c, entry);
    }
  }
  const moves: HistoryMove[] = [];
  let flat = 0;
  let oneYear = 0;
  for (const [code, entry] of per) {
    const years = [...entry.years.keys()].sort((a, b) => a - b);
    if (years.length === 1) oneYear += 1;
    if (years.length < 2) continue;
    const from = years[0];
    const to = years[years.length - 1];
    const fc = entry.years.get(from)!;
    const tc = entry.years.get(to)!;
    if (fc === tc) {
      flat += 1;
      continue;
    }
    moves.push({ c: code, n: entry.name, from, fc, to, tc, d: tc - fc });
  }
  moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.c.localeCompare(b.c));
  return {
    moves,
    summary: { codes: codes.size, changed: moves.length, up: moves.filter((m) => m.d > 0).length, down: moves.filter((m) => m.d < 0).length, flat, oneYear },
  };
}

/** True when a /history row shows a 2024 amount (2024 is an endpoint), so it needs the 2024 year-end note. */
export function shows2024(move: Pick<HistoryMove, "from" | "to">) {
  return move.from === 2024 || move.to === 2024;
}

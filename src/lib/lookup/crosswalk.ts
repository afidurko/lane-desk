import type { SheetLine } from "@/lib/lookup/sheet-book";

export type CrossRow = {
  year: number | null;
  place: string;
  modifier: string;
  fileCents: number | null;
  lookupCents: number | null;
  lines: number;
};

/** Codes that appear on more than one line. The first is the one with the most lines. */
export function repeatedCodes(lines: { code: string }[]) {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line.code, (counts.get(line.code) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code);
}
export function codeCrosswalk(lines: SheetLine[], code: string): CrossRow[] {
  const map = new Map<string, CrossRow>();
  for (const line of lines) {
    if (line.code !== code) continue;
    const place = line.setting === "fac" ? "Facility" : line.setting === "nf" ? "Office" : "Place not named";
    const key = [line.year ?? "", place, line.modifier, line.fileCents ?? "", line.lookupCents ?? ""].join("|");
    const slot = map.get(key);
    if (slot) slot.lines += 1;
    else map.set(key, { year: line.year, place, modifier: line.modifier, fileCents: line.fileCents, lookupCents: line.lookupCents, lines: 1 });
  }
  return [...map.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.place.localeCompare(b.place) || a.modifier.localeCompare(b.modifier));
}

export function crossNote(rows: CrossRow[]) {
  const modifiers = new Set(rows.map((row) => row.modifier));
  if (modifiers.has("26") || modifiers.has("TC")) return "A 26 or TC line is not the global amount.";
  const years = new Set(rows.map((row) => row.year).filter((year): year is number => year !== null));
  if (years.size > 1) return "More than one year is on the sheet. The service year is the price.";
  const places = new Set(rows.map((row) => row.place));
  if (places.has("Facility") && places.has("Office")) return "Office and facility are both on the sheet. The place on the line is the price.";
  return null;
}

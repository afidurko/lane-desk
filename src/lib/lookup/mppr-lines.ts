import { applyMppr } from "@/lib/pricing/mppr";
import type { MpprInfo } from "@/lib/pricing/national";

export type DayLine = { code: string; date: string; year: number | null; fileCents: number | null };
export type DayResult = {
  /** What the file says this line should be, after the therapy reduction when it applies. */
  expectedCents: number | null;
  /** The reduction values for the code, when the code is a therapy code on that year's file. */
  info: MpprInfo | null;
  /** True when this line is paid with the practice-expense cut. */
  reduced: boolean;
};

/**
 * Prices invoice lines as the days they belong to. Lines with the same date of service are treated as one patient's
 * day, one unit each, and the therapy reduction runs across them. A line with no date is priced alone at the full rate,
 * because there is no way to tell which day it belongs to.
 */
export function pricedForDay(lines: readonly DayLine[], tableFor: (year: number) => Record<string, MpprInfo>): DayResult[] {
  const out: DayResult[] = lines.map((line) => ({ expectedCents: line.fileCents, info: null, reduced: false }));
  const days = new Map<string, number[]>();
  lines.forEach((line, index) => {
    if (!line.year || !line.date || line.fileCents === null) return;
    const info = tableFor(line.year)[line.code];
    if (!info || info.fullCents !== line.fileCents) return;
    out[index].info = info;
    const list = days.get(line.date) ?? [];
    list.push(index);
    days.set(line.date, list);
  });
  for (const indexes of days.values()) {
    const results = applyMppr(indexes.map((index) => ({ ...(out[index].info as MpprInfo), units: 1 })));
    indexes.forEach((index, k) => {
      out[index].expectedCents = results[k].cents;
      out[index].reduced = results[k].fullUnits === 0;
    });
  }
  return out;
}

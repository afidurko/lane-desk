/**
 * Therapy multiple-procedure payment reduction (CMS MULT PROC indicator 5).
 * On one patient's day: the unit with the highest non-facility practice-expense RVU is paid at the full rate.
 * Every other therapy unit is paid with its practice-expense RVU cut by 50 percent.
 * Each unit is rounded to the cent before units are added. A tie on practice expense goes to the first one listed.
 * This is the rule in Claims Wedge's answer key (demo/answer_key_mppr.py).
 */
export type MpprItem = {
  /** Non-facility practice-expense RVU. Compared across items only. */
  pe: number;
  units: number;
  fullCents: number;
  reducedCents: number;
};

export type MpprResult = { fullUnits: number; reducedUnits: number; cents: number };

export function applyMppr(items: readonly MpprItem[]): MpprResult[] {
  let top = -1;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].units < 1) continue;
    if (top < 0 || items[i].pe > items[top].pe) top = i;
  }
  return items.map((item, index) => {
    const fullUnits = index === top ? 1 : 0;
    const reducedUnits = Math.max(0, item.units - fullUnits);
    return { fullUnits, reducedUnits, cents: fullUnits * item.fullCents + reducedUnits * item.reducedCents };
  });
}

/** What the screens say when a reduction was applied. */
export const MPPR_LABEL = "Multiple-procedure payment reduction applied";
export const MPPR_EXPLAIN =
  "Medicare pays the full rate on the therapy unit with the highest practice-expense value and cuts the practice-expense part by half on every other therapy unit that day.";

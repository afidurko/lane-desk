export type Post = { file: string; label: string; cents: number; otherCents: number | null };

export type Placed = { cents: number; label: string; otherCents: number | null; note: string };

/** Use a posted file amount. A web page does not supply the dollar. */
export function placeOnFile(input: { lookupCents: number | null; currentCents: number | null; posts: Post[]; only?: string | null }): Placed | null {
  const pool = input.only ? input.posts.filter((row) => row.file === input.only) : input.posts;
  const unique = [...new Map(pool.map((row) => [row.cents, row])).values()];
  if (input.lookupCents !== null) {
    const agreed = unique.filter((row) => Math.abs(row.cents - input.lookupCents!) <= 1);
    if (agreed.length === 1 && (input.currentCents === null || Math.abs(input.currentCents - agreed[0].cents) > 1)) {
      return { cents: agreed[0].cents, label: agreed[0].label, otherCents: agreed[0].otherCents, note: `Their lookup matches ${agreed[0].label}. That posted amount was used.` };
    }
  }
  if (input.currentCents !== null || unique.length !== 1) return null;
  return { cents: unique[0].cents, label: unique[0].label, otherCents: unique[0].otherCents, note: `One posted file has this code. ${unique[0].label} was used.` };
}

/** A public page can name the file. It cannot name the dollar. */
export function fileHint(text: string) {
  const value = text.toLowerCase();
  const hits = [
    /dmepos|durable medical/.test(value) ? "dme" : null,
    /clinical laboratory|\bclfs\b|clinical-laboratory/.test(value) ? "lab" : null,
    /ambulance fee|fee-schedules\/ambulance/.test(value) ? "ambulance" : null,
    /physician fee|\bmpfs\b|fee-schedules\/physician/.test(value) ? "pfs" : null,
  ].filter((item) => item !== null);
  return hits.length === 1 ? hits[0] : null;
}

/** Office or facility, only when the page names one of them. */
export function placeCue(text: string): "nf" | "fac" | null {
  const value = text.toLowerCase();
  const office = /non-?facility|\boffice setting\b/.test(value);
  const facility = /(?<!non-?)\bfacility (?:setting|price)\b/.test(value);
  if (office === facility) return null;
  return office ? "nf" : "fac";
}

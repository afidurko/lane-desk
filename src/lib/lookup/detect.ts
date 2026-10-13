import type { AmbulanceRow, DmeRow, LabRow } from "@/lib/lookup/schedule-price";
import { pickSaved, type SavedRow } from "@/lib/lookup/saved-codes";
import type { CheckLine } from "@/lib/lookup/check";
import { dropOldest } from "@/lib/lookup/persist";

const NEUTRAL = new Set(["25", "59", "76", "77", "XE", "XP", "XS", "XU", "LT", "RT", "RH", "JZ", "TB", "FS", "SC", "HH", "GP", "GO", "GN"]);
const SKIP = new Set(["portable", "system", "rental", "injection", "sodium", "services", "service"]);

export type Candidate = { file: "dme" | "lab" | "ambulance" | "saved"; cents: number; label: string; otherCents: number | null; related: string[] };

export function detectPosted(input: {
  code: string;
  modifier: string;
  year: number | null;
  month: number | null;
  schedule: CheckLine["schedule"];
  dme: DmeRow[] | null;
  lab: LabRow[] | null;
  ambulance: AmbulanceRow[] | null;
  saved: SavedRow[];
}) {
  const candidates = candidatesFor(input);
  const ownFile = input.schedule === "dme" ? "dme" : input.schedule === "lab" ? "lab" : input.schedule === "ambulance" || input.schedule === "miles" ? "ambulance" : null;
  const open = !input.schedule || input.schedule === "none" || input.schedule === "other";
  const own = ownFile ? candidates.filter((row) => row.file === ownFile) : [];
  const others = ownFile ? candidates.filter((row) => row.file !== ownFile) : candidates;
  if (!open) {
    const listed = (ownFile ? others : candidates).map((row) => `${row.label}, ${dollars(row.cents)}`).join("; ");
    return { use: null as Candidate | null, elsewhere: listed ? `Also on file: ${listed}. That file was not used.` : null, related: own[0]?.related ?? [] };
  }
  const amounts = [...new Map(candidates.map((row) => [row.cents, row])).values()];
  if (amounts.length !== 1) {
    const elsewhere = candidates.length === 0 ? null : `Found on more than one file: ${candidates.map((row) => `${row.label}, ${dollars(row.cents)}`).join("; ")}. No amount was chosen.`;
    return { use: null as Candidate | null, elsewhere, related: [] };
  }
  return { use: amounts[0], elsewhere: null, related: amounts[0].related };
}

function candidatesFor(input: {
  code: string;
  modifier: string;
  year: number | null;
  month: number | null;
  dme: DmeRow[] | null;
  lab: LabRow[] | null;
  ambulance: AmbulanceRow[] | null;
  saved: SavedRow[];
}) {
  const found: Candidate[] = [];
  const modifier = input.modifier.trim().toUpperCase();
  if (input.dme) {
    let hits = input.dme.filter((row) => row.c === input.code && row.rural > 0);
    if (modifier && !NEUTRAL.has(modifier)) hits = hits.filter((row) => row.m === modifier && !String(row.m2 || "").trim());
    if (hits.length === 1) {
      const hit = hits[0];
      found.push({ file: "dme", cents: hit.rural, label: "New York rural equipment", otherCents: hit.nr || null, related: relatedByName(hit.name, hit.c, input.dme.filter((row) => row.m === hit.m && !String(row.m2 || "").trim() && row.rural > 0).map((row) => ({ c: row.c, name: row.name }))) });
    }
  }
  if (input.lab) {
    const hits = input.lab.filter((row) => row.c === input.code && typeof row.rate === "number");
    const rates = [...new Set(hits.map((row) => row.rate as number))];
    if (rates.length === 1) found.push({ file: "lab", cents: rates[0], label: "Clinical laboratory", otherCents: null, related: [] });
  }
  if (input.ambulance) {
    const hits = input.ambulance.filter((row) => row.carrier === "13282" && row.loc === "99" && row.c === input.code && row.rural !== null);
    if (hits.length === 1) {
      const related = input.ambulance.filter((row) => row.carrier === "13282" && row.loc === "99" && row.c !== input.code && row.c.startsWith("A04")).map((row) => row.c);
      found.push({ file: "ambulance", cents: hits[0].rural as number, label: "Rest of New York rural ambulance", otherCents: null, related: [...new Set(related)].slice(0, 8) });
    }
  }
  const saved = pickSaved(input.saved, input.code, input.year, input.month);
  if (saved?.cents) {
    const siblings = input.saved.filter((row) => row.type === saved.type && row.year === saved.year && row.c !== saved.c && row.cents !== null);
    found.push({ file: "saved", cents: saved.cents, label: saved.asOf, otherCents: saved.otherCents ?? null, related: relatedByName(saved.name, saved.c, siblings.map((row) => ({ c: row.c, name: row.name }))) });
  }
  return found;
}

function relatedByName(name: string, code: string, rows: { c: string; name: string }[]) {
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4 && !SKIP.has(word));
  let best: string[] = [];
  for (const token of tokens) {
    const hits = [...new Set(rows.filter((row) => row.c !== code && row.name.toLowerCase().includes(token)).map((row) => row.c))];
    if (hits.length > best.length) best = hits;
  }
  return best.slice(0, 6);
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const FOUND = "lane-found-codes";

export type FoundCode = { code: string; year: number | null; source: string; cents: number | null; related: string[]; at: string };

export function rememberFound(rows: FoundCode[]) {
  if (typeof window === "undefined" || rows.length === 0) return;
  const prior = readFound();
  const merged = new Map(prior.map((row) => [`${row.code}|${row.year}|${row.source}`, row]));
  for (const row of rows) merged.set(`${row.code}|${row.year}|${row.source}`, { ...row, at: row.at || new Date().toISOString() });
  window.localStorage.setItem(FOUND, JSON.stringify(dropOldest([...merged.values()], 40)));
}

export function readFound(): FoundCode[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOUND) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is FoundCode => !!row && typeof row.code === "string" && typeof row.source === "string" && Array.isArray(row.related) && typeof row.at === "string").slice(0, 40);
  } catch {
    return [];
  }
}

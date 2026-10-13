import type { AssocHit } from "@/lib/lookup/associate";
import { associate } from "@/lib/lookup/associate";
import type { CheckLine } from "@/lib/lookup/check";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { pickSaved, type SavedRow } from "@/lib/lookup/saved-codes";

export type DmeRow = { c: string; m: string; m2: string; rural: number; nr: number; name: string };
export type LabRow = { c: string; m: string; rate: number | null; name?: string };
export type AmbulanceRow = { carrier: string; loc: string; c: string; rural: number | null };

const PRICE_NEUTRAL = new Set(["25", "59", "76", "77", "XE", "XP", "XS", "XU", "LT", "RT", "RH", "JZ", "TB", "FS", "SC", "HH", "GP", "GO", "GN"]);

export type Priced = { cents: number | null; label: string | null; block: string | null; note: string | null; otherCents: number | null };

export function scheduleOf(raw: string): CheckLine["schedule"] {
  const text = raw.trim().toLowerCase();
  if (!text || text === "0") return "none";
  if (text === "pfs" || text.includes("physician")) return "pfs";
  if (text === "lab") return "lab";
  if (text === "dme" || text.includes("equipment")) return "dme";
  if (text === "opps" || text.includes("outpatient")) return "opps";
  if (text.includes("lpn") || text.includes("hha") || text.includes("nurs")) return "nursing";
  if (text === "amb" || text.includes("ambulance")) return "ambulance";
  if (text.includes("mile")) return "miles";
  return "other";
}

export function auditPrice(input: {
  line: CheckLine;
  hits: AssocHit[];
  onceList: OnceRow[];
  saved?: SavedRow[] | null;
  dme: { rows: DmeRow[] } | null;
  lab: { rows: LabRow[] } | null;
  ambulance: { rows: AmbulanceRow[] } | null;
}): Priced {
  const schedule = input.line.schedule;
  if (!schedule) return { ...fromAssociate(input, input.hits, input.line.modifier), note: null, otherCents: null };
  if (schedule === "none") return unnamed(input);
  if (schedule === "other") return blocked("That schedule name is not a loaded file. No amount was guessed.");
  if (schedule === "dme") return dmePrice(input.dme, input.line);
  if (schedule === "lab") return labPrice(input.lab, input.line);
  if (schedule === "ambulance" || schedule === "miles") return ridePrice(input.ambulance, input.line, schedule);
  if (schedule === "opps") return oncePrice(input.onceList, input.line, /outpatient/i, "outpatient");
  if (schedule === "nursing") return oncePrice(input.onceList, input.line, /medicaid|nursing|home health/i, "nursing");
  return physicianPrice(input);
}

export function dmePrice(file: { rows: DmeRow[] } | null, line: CheckLine): Priced {
  if (!file) return blocked(line.year ? `The ${line.year} equipment file is not loaded.` : "The equipment file is not loaded.");
  const code = line.code.toUpperCase();
  const modifier = line.modifier.toUpperCase();
  const rows = file.rows.filter((row) => row.c.toUpperCase() === code && row.m.toUpperCase() === modifier && !row.m2.trim());
  if (rows.length === 0) return blocked(modifier ? `${code} with ${modifier} is not on the New York equipment file.` : `${code} is not on the New York equipment file.`);
  const amounts = [...new Set(rows.map((row) => row.rural))];
  if (amounts.length !== 1) return blocked(`${code} has more than one rural amount. None was chosen.`);
  const rural = amounts[0];
  if (!rural) return blocked(`${code} has no rural New York amount. The non-rural amount was not used.`);
  return { cents: rural, label: "New York rural equipment", block: null, note: null, otherCents: rows[0].nr || null };
}

export function labPrice(file: { rows: LabRow[] } | null, line: CheckLine): Priced {
  if (!file) return blocked(line.year ? `The ${line.year} lab file is not loaded.` : "The lab file is not loaded.");
  const code = line.code.toUpperCase();
  const modifier = line.modifier.toUpperCase();
  const rows = file.rows.filter((row) => row.c.toUpperCase() === code && (row.m ?? "").toUpperCase() === modifier && typeof row.rate === "number");
  const amounts = [...new Set(rows.map((row) => row.rate as number))];
  if (amounts.length !== 1) return blocked(amounts.length === 0 ? `${code} is not on the lab file for that modifier.` : `${code} has more than one lab amount. None was chosen.`);
  return { cents: amounts[0], label: "Clinical lab", block: null, note: null, otherCents: null };
}

function ridePrice(file: { rows: AmbulanceRow[] } | null, line: CheckLine, schedule: "ambulance" | "miles"): Priced {
  if (schedule === "miles" && line.code.toUpperCase() !== "A0425") return blocked(`${line.code} is not the ground mileage code. Another mileage amount was not used.`);
  if (!file) return blocked(line.year ? `The ${line.year} ambulance file is not loaded.` : "The ambulance file is not loaded.");
  const rows = file.rows.filter((row) => row.carrier === "13282" && row.loc === "99" && row.c.toUpperCase() === line.code.toUpperCase());
  if (rows.length !== 1 || rows[0].rural === null) return blocked(`${line.code} has no Rest of New York rural ambulance amount.`);
  const note = PRICE_NEUTRAL.has(line.modifier.toUpperCase()) ? `${line.modifier.toUpperCase()} does not change this ambulance amount.` : null;
  return { cents: rows[0].rural, label: "Ambulance, Rest of New York, rural", block: null, note, otherCents: null };
}

function oncePrice(rows: OnceRow[], line: CheckLine, source: RegExp, name: string): Priced {
  const picked = pickOnce(rows.filter((row) => source.test(row.s)), line.year, line.month);
  if (!picked) return blocked(`${line.code} has no ${name} amount for ${line.year ?? "that year"}${line.month ? ` month ${line.month}` : ""}. An older amount was not used.`);
  return { cents: picked.c, label: picked.s, block: null, note: picked.t, otherCents: null };
}

function physicianPrice(input: { line: CheckLine; hits: AssocHit[]; onceList: OnceRow[] }): Priced {
  const modifier = input.line.modifier.toUpperCase();
  const neutral = PRICE_NEUTRAL.has(modifier);
  const priced = fromAssociate(input, input.hits.filter((hit) => hit.family === "physician"), neutral ? "" : modifier);
  const note = neutral ? `${modifier} does not change the physician amount.` : null;
  if (priced.block || priced.cents !== null) return { ...priced, note };
  return { cents: null, label: null, block: `${input.line.code} is not on the physician file for ${input.line.year ?? "that year"}. No amount was guessed.`, note, otherCents: null };
}

function unnamed(input: { line: CheckLine; hits: AssocHit[]; onceList: OnceRow[]; saved?: SavedRow[] | null }): Priced {
  const saved = pickSaved(input.saved ?? [], input.line.code, input.line.year, input.line.month);
  if (saved) return { cents: saved.cents, label: saved.asOf, block: null, note: saved.note ?? saved.place ?? null, otherCents: saved.otherCents ?? null };
  const year = input.line.year ? String(input.line.year) : "";
  const physician = input.hits.find((hit) => hit.family === "physician" && typeof hit.row.a[year] === "number");
  const other = pickOnce(input.onceList, input.line.year, input.line.month);
  const loaded = physician ? `A physician amount is loaded for ${input.line.year}. It was not used.` : other ? `A ${other.s} amount is loaded for ${other.t}. It was not used.` : "No dollar was loaded for it.";
  return blocked(`The sheet did not name a schedule. ${loaded}`);
}

function fromAssociate(input: { line: CheckLine; onceList: OnceRow[] }, hits: AssocHit[], modifier: string): Priced {
  const once = pickOnce(input.onceList, input.line.year, input.line.month);
  const priced = associate({
    code: input.line.code,
    modifier,
    year: input.line.year,
    setting: input.line.setting,
    payer: input.line.payer,
    ambiguous: input.line.ambiguous,
    chargeKnown: input.line.chargeKnown,
    paymentAudit: input.line.schedule ? input.line.lookupCents !== null : input.line.paidCents !== null,
    hits,
    once: input.line.schedule === "pfs" ? null : once,
  });
  return { cents: priced.cents, label: priced.label, block: priced.block, note: null, otherCents: null };
}

function blocked(block: string): Priced {
  return { cents: null, label: null, block, note: null, otherCents: null };
}

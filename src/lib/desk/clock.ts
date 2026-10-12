import { KEEP_TYPED_NY_AMOUNTS } from "@/lib/config/mode";
import { screen } from "@/lib/security/mesh";
import { offBook, SCHEDULE, SERVICES, serviceOf } from "@/lib/desk/schedule";

export { SCHEDULE, SERVICES, serviceOf };

export const SAMPLE_NOTE = `Participant, 78. Adult day health. Not a real person.
Therapeutic exercise, supervised, 15 minutes. One unit.
Gait and balance. No new pain reported.
Plan: continue therapeutic exercise next session.`;

export const CODE = "97110";
/** Typed Rest of NY 2026 figure for 97110. Zero in a public build. */
export const UNIT_DOLLARS = KEEP_TYPED_NY_AMOUNTS ? 28.27 : 0;

const UNIT_WORD: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

export type Gate = "ok" | "empty" | "phi" | "wrong-type" | "oversize" | "units" | "split";

export type Line = {
  code: string;
  name: string;
  span: string;
  units: number;
  allowed: number;
};

export type Review = {
  gate: Gate;
  text: string;
  patches: string[];
  units: number | null;
  lines: Line[];
};

function unitsFromMinutes(minutes: number): number | "bad" {
  if (!Number.isInteger(minutes) || minutes < 8) return "bad";
  const count = Math.floor((minutes - 8) / 15) + 1;
  return count >= 1 && count <= 8 ? count : "bad";
}

function countIn(text: string): number | "none" | "bad" {
  if (/\b\d+\.\d+\s+units?\b/i.test(text)) return "bad";
  const named = text.match(/\b([a-z]+|\d+)\s+units?\b/i);
  const minutes = text.match(/\b(\d+)\s+minutes?\b/i);
  let fromUnits: number | "none" | "bad" = "none";
  if (named) {
    const word = named[1].toLowerCase();
    if (word === "a" || word in UNIT_WORD) {
      const count = word === "a" ? 1 : UNIT_WORD[word];
      fromUnits = count >= 1 && count <= 8 ? count : "bad";
    } else if (/^\d+$/.test(word)) {
      const count = Number(word);
      fromUnits = count >= 1 && count <= 8 ? count : "bad";
    } else {
      return "bad";
    }
  }
  let fromMinutes: number | "none" | "bad" = "none";
  if (minutes) fromMinutes = unitsFromMinutes(Number(minutes[1]));
  if (fromUnits === "bad" || fromMinutes === "bad") return "bad";
  if (fromUnits !== "none" && fromMinutes !== "none" && fromUnits !== fromMinutes) return "bad";
  if (fromUnits !== "none") return fromUnits;
  return fromMinutes;
}

export function unitsOf(note: string): number | null {
  const count = countIn(note);
  if (count === "none") return 1;
  return count === "bad" ? null : count;
}

function lineOf(note: string, index: number, raw: string) {
  if (raw.includes("\n")) return raw.replace(/\s+/g, " ");
  const start = note.lastIndexOf("\n", index - 1) + 1;
  const end = note.indexOf("\n", index + raw.length);
  return note.slice(start, end === -1 ? note.length : end).trim();
}

function sameLine(note: string, a: number, b: number) {
  const left = Math.min(a, b);
  const right = Math.max(a, b);
  return !note.slice(left, right).includes("\n");
}

export function linesOf(note: string, rates?: Record<string, number>): Line[] | "split" | "units" | "none" {
  const found: { code: string; name: string; index: number; length: number; span: string }[] = [];
  for (const service of SERVICES) {
    const pattern = new RegExp(service.cue.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(note))) {
      found.push({
        code: service.code,
        name: service.name,
        index: match.index,
        length: match[0].length,
        span: lineOf(note, match.index, match[0]),
      });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  found.sort((left, right) => left.index - right.index || right.length - left.length);
  const hits: typeof found = [];
  for (const hit of found) {
    const covered = hits.some((kept) => hit.index < kept.index + kept.length && kept.index < hit.index + hit.length);
    if (!covered) hits.push(hit);
  }
  if (hits.length === 0) return "none";
  for (let i = 0; i < hits.length; i += 1) {
    for (let j = i + 1; j < hits.length; j += 1) {
      if (hits[i].code !== hits[j].code && sameLine(note, hits[i].index, hits[j].index)) return "split";
    }
  }

  const codes = [...new Set(hits.map((hit) => hit.code))];
  const lines: Line[] = [];
  for (const code of codes) {
    const group = hits.filter((hit) => hit.code === code);
    const counts = group.map((hit) => countIn(hit.span.includes("\n") ? note : hit.span));
    if (counts.includes("bad")) return "units";
    const numbered = counts.filter((item): item is number => typeof item === "number");
    let units: number | null;
    if (numbered.length > 0) {
      const sum = numbered.reduce((total, item) => total + item, 0);
      units = sum >= 1 && sum <= 8 ? sum : null;
      if (units === null) return "units";
    } else if (codes.length === 1) {
      units = unitsOf(note);
      if (units === null) return "units";
    } else {
      units = 1;
    }
    const span = group.find((hit) => countIn(hit.span) !== "none")?.span ?? group[0].span;
    lines.push({ code, name: group[0].name, span, units, allowed: allowedOf(units, code, rates) });
  }
  return lines;
}

const EXPLICIT = /\b(\d{5}|[A-Z]\d{4})\b/gi;

/** Codes written in the note that are not already on a prose hit. Priced only if a rate was passed in. */
export function explicitLines(note: string, already: string[], rates: Record<string, number>): Line[] {
  const found = note.match(EXPLICIT) ?? [];
  const codes = [...new Set(found.map((token) => token.toUpperCase()))].filter((code) => !already.includes(code) && rates[code] != null);
  return codes.map((code) => ({
    code,
    name: serviceOf(code)?.name ?? "Loaded fee file",
    span: code,
    units: 1,
    allowed: allowedOf(1, code, rates),
  }));
}

export function review(note: string, rates?: Record<string, number>): Review {
  const screened = screen(note, "note");
  const patches = screened.patches;
  const blank = { patches, units: null as number | null, lines: [] as Line[] };
  if (screened.stop === "phi") return { gate: "phi", text: screened.text, ...blank };
  if (screened.stop === "oversize") return { gate: "oversize", text: screened.text, ...blank };
  const text = screened.text.trim();
  if (!text) return { gate: "empty", text, ...blank };
  if (offBook(text) && !rates) return { gate: "wrong-type", text, ...blank };
  const lines = linesOf(text, rates);
  if (lines === "split") return { gate: "split", text, ...blank };
  if (lines === "units") return { gate: "units", text, ...blank };
  const extra = rates && lines !== "none" ? explicitLines(text, lines.map((line) => line.code), rates) : rates ? explicitLines(text, [], rates) : [];
  const priced = lines === "none" ? extra : [...lines, ...extra];
  if (priced.length === 0) return { gate: "wrong-type", text, ...blank };
  return { gate: "ok", text, patches, units: priced[0]?.units ?? null, lines: priced };
}

export function gate(note: string): Gate {
  return review(note).gate;
}

export function spanOf(note: string, code = CODE) {
  const lines = linesOf(note);
  if (Array.isArray(lines)) {
    const line = lines.find((item) => item.code === code);
    if (line) return line.span;
  }
  const service = serviceOf(code);
  if (!service) return "";
  const match = note.match(service.cue);
  return match ? match[0].replace(/\s+/g, " ") : "";
}

/**
 * A rate map built straight from a loaded fee file. When a map is marked this way, a code
 * missing from it prices at zero. It never falls back to the typed-in Rest of New York table.
 */
const FROM_FILE = new WeakSet<object>();

export function fromFile(rates: Record<string, number>) {
  FROM_FILE.add(rates);
  return rates;
}

export function allowedOf(units: number, code = CODE, rates?: Record<string, number>) {
  const service = serviceOf(code);
  if (service && !service.separate) return 0;
  const fallback = rates && FROM_FILE.has(rates) ? 0 : (service?.unitDollars ?? UNIT_DOLLARS);
  const dollars = rates?.[code] ?? fallback;
  return Math.round(units * dollars * 100) / 100;
}

export function money(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export const SCHEDULE_LABEL = `${SCHEDULE.name}, ${SCHEDULE.setting}, ${SCHEDULE.asOf}`;

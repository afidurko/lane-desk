import { THERAPY } from "@/lib/desk/therapy-codes";

export const SCHEDULE = {
  id: "mpfs-2026-nf",
  name: "2026 Medicare Physician Fee Schedule",
  setting: "Rest of New York, MAC 13282, locality 99, non-facility, non-QP",
  asOf: "Q4 2026",
} as const;

export type ScheduleId = typeof SCHEDULE.id;

export type Service = {
  code: string;
  name: string;
  unitDollars: number;
  separate: boolean;
  cue: RegExp;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cueFor(code: string, phrases: readonly string[]) {
  const parts = [code, ...phrases].map((part) => escapeRegExp(part).replace(/\s+/g, "\\s+"));
  return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
}

/** Therapy the note clock can read. Amounts are the 2026 Rest of New York fee, or zero when Medicare does not pay the code separately. */
export const SERVICES: readonly Service[] = THERAPY.map((item) => ({
  code: item.code,
  name: item.name,
  unitDollars: item.unitDollars,
  separate: item.separate,
  cue: cueFor(item.code, item.phrases),
}));

const KNOWN = new Set<string>(SERVICES.map((item) => item.code));

export function serviceOf(code: string) {
  return SERVICES.find((item) => item.code.toUpperCase() === code.toUpperCase());
}

export function offBook(text: string) {
  const found = text.match(/\b\d{5}\b|\b[A-Z]\d{4}\b/gi) ?? [];
  return found.some((token) => !KNOWN.has(token.toUpperCase()));
}

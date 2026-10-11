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
  cue: RegExp;
};

/** Timed adult-day therapy codes. 2026 non-facility, non-QP, Rest of New York (MAC 13282, locality 99). */
export const SERVICES = [
  { code: "97110", name: "Therapeutic exercise", unitDollars: 28.27, cue: /therapeutic\s+exercise|\b97110\b/i },
  { code: "97112", name: "Neuromuscular reeducation", unitDollars: 31.85, cue: /neuromuscular\s+re-?education|\b97112\b/i },
  { code: "97116", name: "Gait training", unitDollars: 28.27, cue: /gait\s+training|\b97116\b/i },
  { code: "97140", name: "Manual therapy", unitDollars: 26.97, cue: /manual\s+therapy|\b97140\b/i },
  { code: "97530", name: "Therapeutic activities", unitDollars: 33.97, cue: /therapeutic\s+activities|\b97530\b/i },
  { code: "97535", name: "Self-care training", unitDollars: 31.45, cue: /self-care\s+training|home\s+management|\b97535\b/i },
] as const satisfies readonly Service[];

const KNOWN = new Set<string>(SERVICES.map((item) => item.code));

export function serviceOf(code: string) {
  return SERVICES.find((item) => item.code === code);
}

export function offBook(text: string) {
  const found = text.match(/\b\d{5}\b|\b[A-Z]\d{4}\b/gi) ?? [];
  return found.some((token) => !KNOWN.has(token.toUpperCase()));
}

import { money } from "@/lib/desk/clock";
import { SERVICES } from "@/lib/desk/schedule";
import { screen } from "@/lib/security/mesh";

export type ScheduleRecord = {
  id: string;
  year: number;
  name: string;
  setting: string;
  loaded: boolean;
  source: string;
};

export const SCHEDULES: readonly ScheduleRecord[] = [
  {
    id: "mpfs-2026-nf",
    year: 2026,
    name: "Medicare Physician Fee Schedule",
    setting: "Rest of New York, MAC 13282, locality 99",
    loaded: true,
    source: "2026 non-facility, non-QP, Rest of New York. Work GPCI 1.000, PE 0.950, MP 0.703. The code book can still switch to national.",
  },
  {
    id: "mpfs-2026-fac",
    year: 2026,
    name: "Medicare Physician Fee Schedule",
    setting: "National facility",
    loaded: true,
    source: "Same October 2026 file, facility practice-expense total.",
  },
  {
    id: "mpfs-2025-nf",
    year: 2025,
    name: "Medicare Physician Fee Schedule",
    setting: "National non-facility",
    loaded: true,
    source: "CMS RVU25D October 2025 release. Open the year control on this page.",
  },
  {
    id: "medicaid",
    year: 2026,
    name: "Medicaid",
    setting: "State plan, not selected",
    loaded: false,
    source: "Not loaded. A state file needs its own source. A PACE capitation rate is not a code price.",
  },
  {
    id: "waiver",
    year: 2026,
    name: "Waiver",
    setting: "Not selected",
    loaded: false,
    source: "Not loaded.",
  },
];

export type BookRow = {
  id: string;
  scheduleId: string;
  year: number;
  code: string;
  name: string;
  unitDollars: number;
  source: string;
  origin: "cms" | "browser";
};

export type AddedRow = {
  id: string;
  scheduleId: string;
  year: number;
  code: string;
  name: string;
  unitDollars: number;
  source: string;
  at: string;
};

const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;

export const CMS_ROWS: BookRow[] = SERVICES.map((service) => ({
  id: `cms-${service.code}`,
  scheduleId: "mpfs-2026-nf",
  year: 2026,
  code: service.code,
  name: service.name,
  unitDollars: service.unitDollars,
  source: SCHEDULES[0].source,
  origin: "cms" as const,
}));

export function rowsOf(added: AddedRow[]): BookRow[] {
  return [
    ...CMS_ROWS,
    ...added.map((row) => ({
      id: row.id,
      scheduleId: row.scheduleId,
      year: row.year,
      code: row.code,
      name: row.name,
      unitDollars: row.unitDollars,
      source: row.source,
      origin: "browser" as const,
    })),
  ];
}

export function filterRows(rows: BookRow[], year: string, scheduleId: string, text: string) {
  const query = text.trim().toLowerCase();
  return rows.filter((row) => {
    if (year !== "all" && String(row.year) !== year) return false;
    if (scheduleId !== "all" && row.scheduleId !== scheduleId) return false;
    if (!query) return true;
    return row.code.toLowerCase().includes(query) || row.name.toLowerCase().includes(query);
  });
}

export function scheduleOf(id: string) {
  return SCHEDULES.find((item) => item.id === id);
}

export function admit(input: {
  code: string;
  name: string;
  year: string;
  scheduleId: string;
  amount: string;
  source: string;
  added: AddedRow[];
}): { ok: true; row: AddedRow } | { ok: false; reason: string } {
  const code = input.code.trim().toUpperCase();
  if (!CODE.test(code)) return { ok: false, reason: "Use a 5-digit CPT code, a PLA code like 0001U, or an HCPCS code like A0428." };
  const schedule = scheduleOf(input.scheduleId);
  if (!schedule) return { ok: false, reason: "Pick a schedule." };
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2027) return { ok: false, reason: "Year has to be 2020 through 2027." };
  if (year !== schedule.year) return { ok: false, reason: `${schedule.name} in this book is ${schedule.year}.` };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999) return { ok: false, reason: "Enter an allowed amount greater than zero." };
  const unitDollars = Math.round(amount * 100) / 100;
  const named = screen(input.name.trim(), "field");
  if (named.stop || named.text.trim().length < 3) return { ok: false, reason: "The service name needs a source-safe label." };
  const sourced = screen(input.source.trim(), "field");
  if (sourced.stop || sourced.text.trim().length < 12) return { ok: false, reason: "Add a source. A row without one is not kept." };
  const loaded = CMS_ROWS.find((row) => row.scheduleId === schedule.id && row.code === code);
  if (loaded && loaded.unitDollars !== unitDollars) {
    return { ok: false, reason: `${code} is already on the loaded schedule at ${money(loaded.unitDollars)}.` };
  }
  if (loaded) return { ok: false, reason: `${code} is already on the loaded schedule.` };
  if (input.added.some((row) => row.scheduleId === schedule.id && row.year === year && row.code === code)) {
    return { ok: false, reason: `${code} is already in this browser for that schedule.` };
  }
  return {
    ok: true,
    row: {
      id: crypto.randomUUID(),
      scheduleId: schedule.id,
      year,
      code,
      name: named.text.trim(),
      unitDollars,
      source: sourced.text.trim(),
      at: new Date().toISOString(),
    },
  };
}

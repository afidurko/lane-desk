import { allowedOf, spanOf } from "@/lib/desk/clock";
import { SCHEDULE, serviceOf, type ScheduleId } from "@/lib/desk/schedule";
import { screen } from "@/lib/security/mesh";

export type DeskRow = {
  id: string;
  at: string;
  span: string;
  code: string;
  name: string;
  units: number;
  allowed: number;
  schedule: ScheduleId;
  scriptSeconds: number | null;
  humanSeconds: number | null;
};

const KEY = "lane-desk-rows";
const MAX_ROWS = 200;

function own(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function seconds(value: unknown, max: number) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return null;
  return Math.round(value * 100) / 100;
}

export function sealRow(value: unknown): DeskRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (own(row, "__proto__") || own(row, "prototype")) return null;
  if (typeof row.id !== "string" || !/^[A-Za-z0-9-]{8,80}$/.test(row.id)) return null;
  if (typeof row.span !== "string" || typeof row.at !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(row.at) || row.at.length > 40) return null;
  if (typeof row.code !== "string") return null;
  const service = serviceOf(row.code);
  if (!service) return null;
  const units = typeof row.units === "number" ? Math.round(row.units) : 0;
  if (units < 1 || units > 8) return null;
  const span = screen(row.span, "note");
  if (span.stop) return null;
  const line = spanOf(span.text, service.code);
  if (!line) return null;
  return {
    id: row.id,
    at: row.at,
    span: line,
    code: service.code,
    name: service.name,
    units,
    allowed: allowedOf(units, service.code),
    schedule: SCHEDULE.id,
    scriptSeconds: seconds(row.scriptSeconds, 600),
    humanSeconds: seconds(row.humanSeconds, 86_400),
  };
}

export function readRows(): DeskRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > 500_000) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sealRow).filter((row): row is DeskRow => row !== null).slice(0, MAX_ROWS);
  } catch {
    return [];
  }
}

export function writeRows(rows: DeskRow[]) {
  const sealed = rows.map(sealRow).filter((row): row is DeskRow => row !== null).slice(0, MAX_ROWS);
  localStorage.setItem(KEY, JSON.stringify(sealed));
}

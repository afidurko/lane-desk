import type { AddedRow } from "@/lib/book/book";
import { scheduleOf } from "@/lib/book/book";

const KEY = "lane-book-added";

function own(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function readAdded(): AddedRow[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow);
  } catch {
    return [];
  }
}

export function writeAdded(rows: AddedRow[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 200)));
}

function isRow(value: unknown): value is AddedRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (own(row, "__proto__") || own(row, "prototype")) return false;
  if (typeof row.id !== "string" || typeof row.code !== "string" || typeof row.name !== "string") return false;
  if (typeof row.scheduleId !== "string" || !scheduleOf(row.scheduleId)) return false;
  if (typeof row.year !== "number" || typeof row.unitDollars !== "number" || typeof row.source !== "string") return false;
  if (typeof row.at !== "string") return false;
  return row.source.length >= 12 && row.unitDollars > 0;
}

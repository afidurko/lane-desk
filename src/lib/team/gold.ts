export type GoldRow = {
  id: string;
  at: string;
  code: string;
  units: number;
  allowed: number;
  label: "agree" | "disagree" | "unlabeled";
  note: string;
};

const KEY = "lane-gold-set";
const MAX = 50;

export function readGold(): GoldRow[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow).slice(0, MAX);
  } catch {
    return [];
  }
}

export function writeGold(rows: GoldRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
}

export function addGold(row: Omit<GoldRow, "id" | "at">): GoldRow[] {
  const next: GoldRow = { ...row, id: crypto.randomUUID(), at: new Date().toISOString() };
  const rows = [next, ...readGold()].slice(0, MAX);
  writeGold(rows);
  return rows;
}

function isRow(value: unknown): value is GoldRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.code === "string" && typeof row.units === "number";
}

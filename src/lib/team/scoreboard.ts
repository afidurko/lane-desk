export type BoardRow = {
  id: string;
  at: string;
  codes: string;
  scriptSeconds: number | null;
  humanSeconds: number | null;
  allowed: number;
  status: "priced" | "stopped" | "held";
};

const KEY = "lane-scoreboard";
const MAX = 40;

export function readBoard(): BoardRow[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRow).slice(0, MAX);
  } catch {
    return [];
  }
}

export function writeBoard(rows: BoardRow[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
}

export function addBoard(row: Omit<BoardRow, "id" | "at">): BoardRow[] {
  const next: BoardRow = { ...row, id: crypto.randomUUID(), at: new Date().toISOString() };
  const rows = [next, ...readBoard()].slice(0, MAX);
  writeBoard(rows);
  return rows;
}

function isRow(value: unknown): value is BoardRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.codes === "string" && typeof row.status === "string";
}

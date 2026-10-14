import type { SheetLine } from "@/lib/lookup/sheet-book";

const KEY = "lane-held-sheet";

export type HeldSheet = { name: string; lines: SheetLine[] };

export function holdSheet(name: string, lines: SheetLine[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ name, lines }));
  } catch {
    // The check stays on the page if the browser will not store it.
  }
}

export function readHeld(): HeldSheet | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HeldSheet;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    if (!parsed.lines.every((line) => line && typeof line === "object" && typeof (line as SheetLine).code === "string")) return null;
    return parsed;
  } catch {
    return null;
  }
}

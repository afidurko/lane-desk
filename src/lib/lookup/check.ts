import { money } from "@/lib/desk/clock";

const CODE = /\b(\d{4}[A-Z]|[A-Z]\d{4}|\d{5})(?:-([A-Z0-9]{2}))?\b/;
const DATE = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;
const MONEY = /\$?\s*(\d+\.\d{2})\b/;

export type CheckLine = {
  code: string;
  modifier: string;
  date: string;
  year: number | null;
  billedCents: number | null;
};

export type PayBucket = "match" | "off" | "look";

/** Read code, date, and amount. A spreadsheet uses the charge column, not an allowed column. */
export function readInvoiceLines(raw: string): CheckLine[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = text.split("\n").map((row) => row.trim()).filter(Boolean);
  return fromSheet(rows) ?? fromLines(rows);
}

/** Match, off, or a line a person still has to look at. */
export function payBucket(line: { year: number | null; billedCents: number | null }, fileCents: number | null): PayBucket {
  if (!line.year || fileCents === null || line.billedCents === null) return "look";
  return Math.abs(line.billedCents - fileCents) <= 1 ? "match" : "off";
}

/** Says what is known. A missing file amount is not filled in. */
export function paymentAlert(input: { code: string; year: number | null; billedCents: number | null; fileCents: number | null }) {
  const kind = payBucket(input, input.fileCents);
  if (kind === "match") return { kind, reason: `${input.code} matches the file.` };
  if (kind === "off" && input.fileCents !== null && input.billedCents !== null) {
    const gap = input.billedCents - input.fileCents;
    return {
      kind,
      reason: `Payment mismatch on ${input.code}. The file is ${money(input.fileCents / 100)}. The invoice billed ${money(input.billedCents / 100)}, ${gap > 0 ? "over" : "under"} by ${money(Math.abs(gap) / 100)}.`,
    };
  }
  if (!input.year) return { kind: "look" as const, reason: `${input.code} has no year. It cannot be priced.` };
  if (input.fileCents === null) return { kind: "look" as const, reason: `${input.code} is not on a loaded file for ${input.year}. No amount was guessed.` };
  return { kind: "look" as const, reason: `${input.code} has no charge. Payment would wait.` };
}

function fromSheet(rows: string[]): CheckLine[] | null {
  if (rows.length < 2) return null;
  const sep = rows[0].includes("\t") ? "\t" : rows[0].includes(",") ? "," : "";
  if (!sep) return null;
  const header = splitCells(rows[0], sep).map((cell) => cell.trim().toLowerCase());
  const codeCol = header.findIndex((cell) => /\b(cpt|hcpcs|procedure|code)\b/.test(cell));
  if (codeCol < 0) return null;
  const dateCol = header.findIndex((cell) => /\b(dos|date)\b/.test(cell));
  let moneyCol = header.findIndex((cell) => /\b(charge|billed)\b/.test(cell));
  if (moneyCol < 0) moneyCol = header.findIndex((cell) => /\bamount\b/.test(cell) && !/allowed/.test(cell));
  if (moneyCol < 0) return null;
  const lines: CheckLine[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCells(row, sep);
    const found = (cells[codeCol] ?? "").toUpperCase().match(CODE);
    if (!found) continue;
    const date = dateCol >= 0 ? normalize(cells[dateCol] ?? "") : "";
    lines.push({
      code: found[1],
      modifier: (found[2] ?? "").toUpperCase(),
      date,
      year: yearOf(date),
      billedCents: centsOf(cells[moneyCol] ?? ""),
    });
  }
  return lines;
}

function fromLines(rows: string[]): CheckLine[] {
  const start = rows[0] && /code|hcpcs|cpt/i.test(rows[0]) && rows[0].includes(",") ? 1 : 0;
  const lines: CheckLine[] = [];
  for (const row of rows.slice(start)) {
    const found = row.match(CODE);
    if (!found) continue;
    const date = normalize(row.match(DATE)?.[1] ?? "");
    const amount = row.match(MONEY)?.[1];
    lines.push({
      code: found[1].toUpperCase(),
      modifier: (found[2] ?? "").toUpperCase(),
      date,
      year: yearOf(date),
      billedCents: amount ? Math.round(Number(amount) * 100) : null,
    });
  }
  return lines;
}

function splitCells(row: string, sep: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === "\"") {
      if (quoted && row[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === sep && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function centsOf(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function yearOf(date: string) {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return year >= 2020 && year <= 2026 ? year : null;
}

function normalize(value: string) {
  const found = value.match(DATE)?.[1] ?? value.trim();
  if (!found) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(found)) return found;
  const parts = found.split("/");
  if (parts.length !== 3) return "";
  const month = parts[0].padStart(2, "0");
  const day = parts[1].padStart(2, "0");
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${month}-${day}`;
}

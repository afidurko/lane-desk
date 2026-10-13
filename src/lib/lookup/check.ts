import { money } from "@/lib/desk/clock";

const CODE = /\b(\d{4}[A-Z]|[A-Z]\d{4}|\d{5})(?:-([A-Z0-9]{2}))?\b/;
const DATE = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;

export type CheckLine = {
  code: string;
  modifier: string;
  date: string;
  year: number | null;
  month: number | null;
  units: number | null;
  billedCents: number | null;
  paidCents: number | null;
  paidKind: "paid" | "allowed" | null;
  setting: "nf" | "fac" | null;
  payer: "medicare" | "medicaid" | null;
  ambiguous: boolean;
  chargeKnown: boolean;
};

export type PayBucket = "match" | "off" | "look";

/** Read code, date, and amount. A spreadsheet uses the charge column, not an allowed column. */
export function readInvoiceLines(raw: string): CheckLine[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = text.split("\n").map((row) => row.trim()).filter(Boolean);
  return fromSheet(rows) ?? fromLines(rows);
}

/** Match, off, or a line a person still has to look at. */
export function payBucket(
  line: { year: number | null; billedCents: number | null; units?: number | null },
  fileCents: number | null,
): PayBucket {
  if (!line.year || fileCents === null || line.billedCents === null) return "look";
  if (line.units === null) return "look";
  const expected = fileCents * (line.units ?? 1);
  return Math.abs(line.billedCents - expected) <= 1 ? "match" : "off";
}

/** Says what is known. A missing file amount is not filled in. */
export function paymentAlert(input: {
  code: string;
  year: number | null;
  billedCents: number | null;
  fileCents: number | null;
  units?: number | null;
  block?: string | null;
}) {
  if (input.block) return { kind: "look" as const, reason: input.block };
  const kind = payBucket(input, input.fileCents);
  if (kind === "match") return { kind, reason: `${input.code} matches the file.` };
  if (input.units === null && input.year && input.fileCents !== null && input.billedCents !== null) {
    return { kind: "look" as const, reason: `${input.code} has no units, so it is not matched.` };
  }
  if (kind === "off" && input.fileCents !== null && input.billedCents !== null) {
    const expected = input.fileCents * (input.units ?? 1);
    const gap = input.billedCents - expected;
    const units = input.units ?? 1;
    return {
      kind,
      reason: `Payment mismatch on ${input.code}. The file is ${money(expected / 100)} for ${units} ${units === 1 ? "unit" : "units"}. The invoice billed ${money(input.billedCents / 100)}, ${gap > 0 ? "over" : "under"} by ${money(Math.abs(gap) / 100)}.`,
    };
  }
  if (!input.year) return { kind: "look" as const, reason: `${input.code} has no year. It cannot be priced.` };
  if (input.fileCents === null) return { kind: "look" as const, reason: `${input.code} is not on a loaded file for ${input.year}. No amount was guessed.` };
  return { kind: "look" as const, reason: `${input.code} has no charge. Payment would wait.` };
}

/** The administrator amount against the full file amount. Paid is not treated as the charge. */
export function auditReport(input: {
  code: string;
  year: number | null;
  billedCents: number | null;
  paidCents: number | null;
  paidKind: "paid" | "allowed" | null;
  fileCents: number | null;
  units?: number | null;
  block?: string | null;
}) {
  const admin = input.paidCents === null ? null : administratorAlert(input);
  const charge = paymentAlert({
    code: input.code,
    year: input.year,
    billedCents: input.billedCents,
    fileCents: input.fileCents,
    units: input.units,
    block: input.block,
  });
  if (input.block) return { kind: "look" as const, side: "look" as const, gapCents: null, reasons: [input.block] };
  if (admin) {
    const reasons: string[] = [];
    if (admin.kind !== "match") reasons.push(admin.reason);
    if (input.billedCents !== null && charge.kind === "off") reasons.push(charge.reason);
    if (admin.kind === "match") reasons.push(admin.reason);
    if (input.billedCents !== null && charge.kind === "match" && admin.kind !== "match") reasons.push("The charge matches the file.");
    if (input.billedCents === null && admin.kind === "match") reasons.push("No charge was on the report, so the bill itself was not checked.");
    const units = input.units === undefined ? 1 : input.units;
    const chargeGap = input.billedCents !== null && input.fileCents !== null && units !== null ? input.billedCents - input.fileCents * units : null;
    const kind = admin.kind === "off" || charge.kind === "off" ? "off" as const : admin.kind === "look" ? "look" as const : input.billedCents !== null && charge.kind !== "match" ? charge.kind : "match" as const;
    const side = admin.kind === "off" ? admin.side : kind === "off" && chargeGap !== null ? (chargeGap > 0 ? "over" as const : "under" as const) : kind === "match" ? "match" as const : "look" as const;
    const gapCents = admin.kind === "off" ? admin.gapCents : kind === "off" ? chargeGap : admin.kind === "match" ? 0 : null;
    return { kind, side, gapCents, reasons };
  }
  const gap = input.billedCents !== null && input.fileCents !== null && input.units !== null
    ? input.billedCents - input.fileCents * (input.units ?? 1)
    : null;
  const side = charge.kind !== "off" || gap === null ? charge.kind : gap > 0 ? "over" as const : "under" as const;
  return { kind: charge.kind, side, gapCents: charge.kind === "off" ? gap : null, reasons: [charge.reason] };
}

function administratorAlert(input: {
  code: string;
  year: number | null;
  paidCents: number | null;
  paidKind: "paid" | "allowed" | null;
  fileCents: number | null;
  units?: number | null;
  block?: string | null;
}) {
  const word = input.paidKind === "allowed" ? "allowed" : "paid";
  if (input.block) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: input.block };
  if (!input.year) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: `${input.code} has no year. It cannot be priced.` };
  if (input.fileCents === null) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: `${input.code} is not on a loaded file for ${input.year}. No amount was guessed.` };
  if (input.units === null) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: `${input.code} has no units, so the administrator amount is not matched.` };
  if (input.paidCents === null) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: `${input.code} has no administrator amount.` };
  const units = input.units ?? 1;
  const expected = input.fileCents * units;
  const gap = input.paidCents - expected;
  if (Math.abs(gap) <= 1) {
    return { kind: "match" as const, side: "match" as const, gapCents: 0, reason: `${input.code} matches the file. The administrator ${word} ${money(input.paidCents / 100)}.` };
  }
  const side = gap > 0 ? "over" as const : "under" as const;
  return {
    kind: "off" as const,
    side,
    gapCents: gap,
    reason: `${input.code}. The file is ${money(expected / 100)} for ${units} ${units === 1 ? "unit" : "units"}. The administrator ${word} ${money(input.paidCents / 100)}, ${side} by ${money(Math.abs(gap) / 100)}.`,
  };
}

function fromSheet(rows: string[]): CheckLine[] | null {
  if (rows.length < 2) return null;
  const sep = rows[0].includes("\t") ? "\t" : rows[0].includes(",") ? "," : "";
  if (!sep) return null;
  const header = splitCells(rows[0], sep).map((cell) => cell.trim().toLowerCase());
  const codeCol = header.findIndex((cell) => /\b(cpt|hcpcs|procedure|code)\b/.test(cell));
  if (codeCol < 0) return null;
  const dateCol = header.findIndex((cell) => /\b(dos|date)\b/.test(cell));
  const unitCol = header.findIndex((cell) => isUnitHeader(cell));
  const settingCol = header.findIndex((cell) => /\b(setting|place|pos)\b/.test(cell));
  const payerCol = header.findIndex((cell) => /\b(payer|program)\b/.test(cell));
  const paidCol = header.findIndex((cell) => isPaidHeader(cell));
  const allowedCol = header.findIndex((cell) => isAllowedHeader(cell));
  const chargeCol = header.findIndex((cell) => isChargeHeader(cell));
  const amountCol = chargeCol >= 0 ? -1 : header.findIndex((cell) => isPlainAmount(cell));
  const moneyCol = chargeCol >= 0 ? chargeCol : amountCol;
  const chargeKnown = moneyCol >= 0;
  const lines: CheckLine[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCells(row, sep);
    const found = (cells[codeCol] ?? "").toUpperCase().match(CODE);
    if (!found) continue;
    const date = dateCol >= 0 ? normalize(cells[dateCol] ?? "") : "";
    const settingCell = settingCol >= 0 ? cells[settingCol] ?? "" : "";
    const payerCell = payerCol >= 0 ? cells[payerCol] ?? "" : "";
    const paidKind = paidCol >= 0 ? "paid" as const : allowedCol >= 0 ? "allowed" as const : null;
    const paidSource = paidCol >= 0 ? paidCol : allowedCol;
    lines.push({
      code: found[1],
      modifier: (found[2] ?? "").toUpperCase(),
      date,
      year: yearOf(date),
      month: monthOf(date),
      units: unitCol >= 0 ? unitsOf(cells[unitCol] ?? "") : null,
      billedCents: chargeKnown ? centsOf(cells[moneyCol] ?? "") : null,
      paidCents: paidKind ? centsOf(cells[paidSource] ?? "") : null,
      paidKind: paidKind && centsOf(cells[paidSource] ?? "") !== null ? paidKind : null,
      setting: settingIn(settingCell),
      payer: payerIn(payerCell),
      ambiguous: false,
      chargeKnown,
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
    const paidLabeled = amountAfter(row, "paid");
    const allowedLabeled = amountAfter(row, "allowed");
    const chargeLabeled = amountAfter(row, "charge") ?? amountAfter(row, "billed");
    const paidCents = paidLabeled ?? allowedLabeled;
    const paidKind = paidLabeled !== null ? "paid" as const : allowedLabeled !== null ? "allowed" as const : null;
    const amounts = [...row.matchAll(/\$?\s*(\d+\.\d{2})\b/g)].map((item) => item[1]);
    const labeled = new Set([paidLabeled, allowedLabeled, chargeLabeled].filter((item): item is number => item !== null));
    const unlabeled = amounts.map((item) => Math.round(Number(item) * 100)).filter((item) => !labeled.has(item));
    if (paidKind || chargeLabeled !== null) {
      const billedCents = chargeLabeled !== null ? chargeLabeled : unlabeled.length === 1 ? unlabeled[0] : null;
      const ambiguous = chargeLabeled !== null ? unlabeled.length > 0 : unlabeled.length > 1;
      lines.push({
        code: found[1].toUpperCase(),
        modifier: (found[2] ?? "").toUpperCase(),
        date,
        year: yearOf(date),
        month: monthOf(date),
        units: unitsIn(row),
        billedCents: ambiguous ? null : billedCents,
        paidCents: ambiguous ? null : paidCents,
        paidKind: ambiguous ? null : paidKind,
        setting: settingIn(row),
        payer: payerIn(row),
        ambiguous,
        chargeKnown: !ambiguous && billedCents !== null,
      });
      continue;
    }
    const ambiguous = amounts.length > 1;
    lines.push({
      code: found[1].toUpperCase(),
      modifier: (found[2] ?? "").toUpperCase(),
      date,
      year: yearOf(date),
      month: monthOf(date),
      units: unitsIn(row),
      billedCents: ambiguous || amounts.length === 0 ? null : Math.round(Number(amounts[0]) * 100),
      paidCents: null,
      paidKind: null,
      setting: settingIn(row),
      payer: payerIn(row),
      ambiguous,
      chargeKnown: true,
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

function isChargeHeader(cell: string) {
  if (/allowed|paid|payment|reimburs/.test(cell)) return false;
  return /\b(charge|billed)\b/.test(cell);
}

function isPaidHeader(cell: string) {
  if (/copay|patient|allowed|reimburs/.test(cell)) return false;
  return /\b(paid|payment)\b/.test(cell);
}

function isAllowedHeader(cell: string) {
  return /\b(allowed|reimburs)/.test(cell);
}

function isUnitHeader(cell: string) {
  return /^(units?|qty|quantity)$/.test(cell.trim()) || /\b(units|qty|quantity)\b/.test(cell);
}

function amountAfter(row: string, word: string) {
  const found = row.match(new RegExp(`\\b${word}\\b\\s*:?\\s*\\$?\\s*(\\d+\\.\\d{2})`, "i"));
  return found ? Math.round(Number(found[1]) * 100) : null;
}

function isPlainAmount(cell: string) {
  if (/allowed|paid|payment|reimburs/.test(cell)) return false;
  return /\bamount\b/.test(cell);
}

function unitsOf(raw: string) {
  const cleaned = raw.trim();
  if (!/^\d{1,2}$/.test(cleaned)) return null;
  const units = Number(cleaned);
  return units >= 1 ? units : null;
}

function unitsIn(text: string) {
  const named = text.match(/\b(\d{1,2})\s*units?\b/i) ?? text.match(/\bunits?\s*[:x]?\s*(\d{1,2})\b/i) ?? text.match(/\bx\s*(\d{1,2})\b/i);
  if (!named) return null;
  const units = Number(named[1]);
  return units >= 1 ? units : null;
}

function settingIn(text: string): "nf" | "fac" | null {
  if (/non-?\s*facility|\boffice\b/i.test(text)) return "nf";
  if (/\bfacility\b/i.test(text)) return "fac";
  return null;
}

function payerIn(text: string): "medicare" | "medicaid" | null {
  if (/\bmedicaid\b/i.test(text)) return "medicaid";
  if (/\bmedicare\b/i.test(text)) return "medicare";
  return null;
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

function monthOf(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const month = Number(date.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
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

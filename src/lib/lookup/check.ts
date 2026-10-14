import { money } from "@/lib/desk/clock";
import { profilePlace } from "@/lib/lookup/profile";

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
  claim?: "professional" | "institutional" | "other" | null;
  payer: "medicare" | "medicaid" | null;
  ambiguous: boolean;
  chargeKnown: boolean;
  schedule: "none" | "pfs" | "lab" | "dme" | "opps" | "nursing" | "ambulance" | "miles" | "other" | null;
  lookupCents: number | null;
  adminCents: number | null;
  seqRate: number | null;
  seqPayCents: number | null;
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
  const units = line.units === undefined ? 1 : line.units;
  if (units === null || units === 0) return "look";
  const expected = Math.round(fileCents * units);
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
  if (input.units === 0) return { kind: "look" as const, reason: `${input.code} has 0 units, so it is not matched.` };
  if (input.units === null && input.year && input.fileCents !== null && input.billedCents !== null) {
    return { kind: "look" as const, reason: `${input.code} has no units, so it is not matched.` };
  }
  if (kind === "off" && input.fileCents !== null && input.billedCents !== null) {
    const expected = Math.round(input.fileCents * (input.units ?? 1));
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
    const chargeGap = input.billedCents !== null && input.fileCents !== null && units !== null && units !== 0 ? input.billedCents - Math.round(input.fileCents * units) : null;
    const kind = admin.kind === "off" || charge.kind === "off" ? "off" as const : admin.kind === "look" ? "look" as const : input.billedCents !== null && charge.kind !== "match" ? charge.kind : "match" as const;
    const side = admin.kind === "off" ? admin.side : kind === "off" && chargeGap !== null ? (chargeGap > 0 ? "over" as const : "under" as const) : kind === "match" ? "match" as const : "look" as const;
    const gapCents = admin.kind === "off" ? admin.gapCents : kind === "off" ? chargeGap : admin.kind === "match" ? 0 : null;
    return { kind, side, gapCents, reasons };
  }
  const gap = input.billedCents !== null && input.fileCents !== null && typeof input.units === "number" && input.units !== 0
    ? input.billedCents - Math.round(input.fileCents * input.units)
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
  if (input.units === null || input.units === undefined || input.units === 0) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: `${input.code} has no units, so the administrator amount is not matched.` };
  if (input.paidCents === null) return { kind: "look" as const, side: "look" as const, gapCents: null, reason: `${input.code} has no administrator amount.` };
  const units = input.units;
  const expected = Math.round(input.fileCents * units);
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

/** Their lookup against the file for the schedule they named. The provider charge is not the grade. */
export function gradeLookup(input: {
  code: string;
  year: number | null;
  units: number | null;
  lookupCents: number | null;
  fileCents: number | null;
  adminCents: number | null;
  seqRate: number | null;
  seqPayCents: number | null;
  block: string | null;
  note: string | null;
  otherCents: number | null;
  choseCents?: number | null;
}) {
  if (input.block) return { kind: "look" as const, side: "look" as const, gapCents: null, adminUnder: false, bare: true, reasons: [input.block] };
  if (!input.year) return { kind: "look" as const, side: "look" as const, gapCents: null, adminUnder: false, bare: true, reasons: [`${input.code} has no year. It cannot be priced.`] };
  const reasons: string[] = [];
  if (input.note) reasons.push(input.note);
  const units = input.units && input.units > 0 ? input.units : null;
  if (input.choseCents && input.lookupCents && units && Math.abs(input.choseCents - Math.round(input.lookupCents * units)) > 1) {
    reasons.push(`They chose ${money(input.choseCents / 100)}. The lookup for ${units} ${units === 1 ? "unit" : "units"} is ${money(Math.round(input.lookupCents * units) / 100)}.`);
  }
  const lineFile = input.fileCents !== null && units !== null ? Math.round(input.fileCents * units) : null;
  const paid = describeAdmin(input.adminCents, lineFile, input.otherCents, units, input.seqRate);
  const adminUnder = paid.kind === "under" || paid.kind === "wrong";
  if (paid.kind === "wrong") {
    const reasons = [paid.text];
    if (input.lookupCents !== null && input.fileCents !== null && Math.abs(input.lookupCents - input.fileCents) <= 1) {
      reasons.push(`${input.code} is ${money(input.fileCents / 100)} on the rural file.`);
    }
    pushSeq(reasons, input, lineFile);
    return { kind: "off" as const, side: "under" as const, gapCents: paid.gap, adminUnder: true, bare: false, reasons };
  }
  if (paid.text) reasons.push(paid.text);
  if (input.fileCents === null) {
    reasons.unshift(`${input.code} is not on the named schedule for ${input.year}. No amount was guessed.`);
    return { kind: "look" as const, side: "look" as const, gapCents: null, adminUnder: false, bare: true, reasons };
  }
  if (input.lookupCents === null) {
    reasons.unshift(`${input.code}. Their lookup is blank. The file is ${money(input.fileCents / 100)} per unit.`);
    pushSeq(reasons, input, lineFile);
    return { kind: "look" as const, side: "look" as const, gapCents: null, adminUnder, bare: true, reasons };
  }
  const gap = input.lookupCents - input.fileCents;
  if (Math.abs(gap) <= 1) {
    reasons.unshift(`${input.code} lookup matches the file at ${money(input.fileCents / 100)} per unit.`);
    pushSeq(reasons, input, lineFile);
    return { kind: "match" as const, side: "match" as const, gapCents: 0, adminUnder, bare: false, reasons };
  }
  const side = gap > 0 ? "over" as const : "under" as const;
  reasons.unshift(`${input.code}. Their lookup is ${money(input.lookupCents / 100)}. The file is ${money(input.fileCents / 100)} per unit, ${side} by ${money(Math.abs(gap) / 100)}.`);
  pushSeq(reasons, input, lineFile);
  return { kind: "off" as const, side, gapCents: gap, adminUnder, bare: false, reasons };
}

function describeAdmin(admin: number | null, lineFile: number | null, otherCents: number | null, units: number | null, seqRate: number | null) {
  if (admin === null || lineFile === null || units === null) return { kind: "none" as const, text: "", gap: null };
  const reduced = Math.round(lineFile * (seqRate ?? 0.98));
  const payable = seqRate ? reduced : lineFile;
  const other = otherCents ? Math.round(otherCents * units) : null;
  if (other !== null && Math.abs(admin - other) <= 1) {
    return {
      kind: "wrong" as const,
      gap: payable - admin,
      text: `Wrong fee schedule. Their amount is ${money(admin / 100)}, the non-rural amount. The rural amount${seqRate ? ` after ${seqRate}` : ""} is ${money(payable / 100)}.`,
    };
  }
  if (Math.abs(admin - lineFile) <= 1) return { kind: "match" as const, text: `The administrator paid the file, ${money(lineFile / 100)}.`, gap: 0 };
  if (seqRate && Math.abs(admin - reduced) <= 1) return { kind: "seq" as const, text: `The administrator paid the file after ${seqRate}, ${money(reduced / 100)}.`, gap: 0 };
  const gap = admin - payable;
  const side = gap > 0 ? "over" : "under";
  return { kind: side, gap, text: `Their amount is ${money(admin / 100)}. The file for the line is ${money(payable / 100)}, ${side} by ${money(Math.abs(gap) / 100)}.` };
}

function pushSeq(reasons: string[], input: { seqRate: number | null; seqPayCents: number | null }, lineFile: number | null) {
  if (input.seqRate === null || lineFile === null) return;
  const reduced = Math.round(lineFile * input.seqRate);
  if (input.seqPayCents === null) {
    reasons.push(`The sheet applies ${input.seqRate}. The file for the line at that rate is ${money(reduced / 100)}.`);
    return;
  }
  const gap = input.seqPayCents - reduced;
  reasons.push(Math.abs(gap) <= 1
    ? `Their amount at ${input.seqRate} matches the file, ${money(reduced / 100)}.`
    : `Their reduced amount is ${money(input.seqPayCents / 100)}. The file at ${input.seqRate} is ${money(reduced / 100)}.`);
}

export function sheetSeparator(header: string) {
  const tab = header.split("\t").length;
  const semi = header.split(";").length;
  const comma = header.split(",").length;
  const best = Math.max(tab, semi, comma);
  if (best < 2) return "";
  if (tab === best) return "\t";
  if (semi === best) return ";";
  return ",";
}

function fromSheet(rows: string[]): CheckLine[] | null {
  if (rows.length < 2) return null;
  const sep = sheetSeparator(rows[0]);
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
      setting: profilePlace(`${settingCell} ${payerCell}`, claimIn(payerCell || settingCell)),
      claim: claimIn(payerCell || settingCell),
      payer: payerIn(payerCell),
      ambiguous: false,
      chargeKnown,
      ...blankAudit(),
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
    const lookupCents = amountAfter(row, "lookup");
    const adminCents = amountAfter(row, "admin");
    const seq = seqOf(row);
    const audit = {
      schedule: scheduleToken(row),
      lookupCents,
      adminCents,
      seqRate: seq.rate,
      seqPayCents: seq.pay,
    };
    const labeled = new Set([paidLabeled, allowedLabeled, chargeLabeled, lookupCents, adminCents, seq.pay].filter((item): item is number => item !== null));
    if (seq.rate !== null) labeled.add(Math.round(seq.rate * 100));
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
        setting: profilePlace(row, claimIn(row)),
        claim: claimIn(row),
        payer: payerIn(row),
        ambiguous,
        chargeKnown: !ambiguous && billedCents !== null,
        ...audit,
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
      setting: profilePlace(row, claimIn(row)),
      claim: claimIn(row),
      payer: payerIn(row),
      ambiguous,
      chargeKnown: true,
      ...audit,
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
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(cleaned)) return null;
  const units = Number(cleaned);
  return Number.isFinite(units) && units >= 0 && units <= 999 ? units : null;
}

function unitsIn(text: string) {
  const named = text.match(/\b(\d{1,3}(?:\.\d{1,3})?)\s*units?\b/i) ?? text.match(/\bunits?\s*[:x]?\s*(\d{1,3}(?:\.\d{1,3})?)\b/i);
  if (!named) return null;
  const units = Number(named[1]);
  return units >= 0 && units <= 999 ? units : null;
}

function blankAudit(): Pick<CheckLine, "schedule" | "lookupCents" | "adminCents" | "seqRate" | "seqPayCents"> {
  return { schedule: null, lookupCents: null, adminCents: null, seqRate: null, seqPayCents: null };
}

function scheduleToken(row: string): CheckLine["schedule"] {
  const found = row.match(/\bschedule\s+(none|pfs|lab|dme|opps|nursing|ambulance|miles|other)\b/i);
  return found ? (found[1].toLowerCase() as CheckLine["schedule"]) : null;
}

function seqOf(row: string) {
  const rate = row.match(/\bseq\s+(0\.\d{2})\b/i);
  const pay = amountAfter(row, "seqpay");
  return { rate: rate ? Number(rate[1]) : null, pay };
}

function claimIn(text: string): "professional" | "institutional" | "other" | null {
  if (/\binstitutional\b/i.test(text)) return "institutional";
  if (/\bprofessional\b/i.test(text)) return "professional";
  if (/\bother paper\b/i.test(text)) return "other";
  return null;
}

function payerIn(text: string): "medicare" | "medicaid" | null {
  if (/\bmedicaid\b/i.test(text)) return "medicaid";
  if (/\bmedicare\b/i.test(text)) return "medicare";
  return null;
}

function centsOf(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
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

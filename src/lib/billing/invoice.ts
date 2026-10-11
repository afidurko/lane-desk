import { quoteCode, type Books, type Claim, type Line } from "@/lib/billing/billing";

export type InvoiceLine = {
  id: string;
  entity: string;
  code: string;
  modifier: string;
  date: string;
  service: string;
  category: string;
  amountCents: number | null;
  allowedCents: number | null;
  note: string;
  alert: Alert | null;
  dispute: string | null;
};

export type Alert = {
  level: "high";
  reason: string;
  expectedCode: string;
  expectedCents: number | null;
};

export type Invoice = {
  id: string;
  source: string;
  date: string;
  entities: string[];
  lines: InvoiceLine[];
  amountDueCents: number | null;
  alerts: number;
};

const CODE = /(?:^|[^A-Z0-9])([A-Z]\d{4}|\d{5})(?:-([A-Z0-9]{2}))?/g;
const DATE = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/;
const MONEY = /(\d+(?:\.\d{2}))/;
const ENTITY = /^(?:entity|provider|organization|facility)\s*[:|-]\s*(.+)$/i;
const NPI = /^npi\s*[:|-]\s*(\d{10})$/i;

export function categorize(schedule: string) {
  if (schedule.startsWith("Ambulance")) return "Transportation";
  if (schedule.startsWith("Clinical lab")) return "Laboratory";
  if (schedule.startsWith("DMEPOS")) return "Equipment";
  if (schedule.startsWith("Physician")) return "Professional";
  if (schedule.startsWith("NY Medicaid")) return "New York Medicaid";
  return "Unmatched";
}

export function parseInvoice(text: string, books: Books, fallbackDate: string): Invoice {
  const rows = text
    .split(/\n+/)
    .map((row) => row.trim())
    .filter(Boolean);
  const parsed: InvoiceLine[] = [];
  let entity = "Unassigned";

  for (const row of rows) {
    const named = row.match(ENTITY);
    if (named) {
      entity = named[1].trim();
      continue;
    }
    const npi = row.match(NPI);
    if (npi) {
      entity = `NPI ${npi[1]}`;
      continue;
    }
    const codes = [...row.matchAll(CODE)];
    if (codes.length === 0) continue;
    const date = normalizeDate(row.match(DATE)?.[1] ?? fallbackDate);
    const amount = row.match(MONEY)?.[1];
    for (const match of codes) {
      const code = match[1].toUpperCase();
      const modifier = (match[2] ?? "").toUpperCase();
      const quoted = quoteCode(books, code, modifier);
      const amountCents = amount ? Math.round(Number(amount) * 100) : null;
      const alert = verify(code, quoted.schedule, quoted.allowedCents, amountCents);
      parsed.push({
        id: `inv-${entity}-${code}-${parsed.length}`,
        entity,
        code,
        modifier,
        date,
        service: quoted.note || stripCodes(row),
        category: categorize(quoted.schedule),
        amountCents,
        allowedCents: quoted.allowedCents,
        note: quoted.schedule,
        alert,
        dispute: null,
      });
    }
  }

  const entities = [...new Set(parsed.map((line) => line.entity))];
  const known = parsed.filter((line) => line.amountCents !== null);
  const amountDueCents = known.length > 0 ? known.reduce((sum, line) => sum + (line.amountCents ?? 0), 0) : null;
  return {
    id: `invoice-${Date.now()}`,
    source: text.slice(0, 80),
    date: parsed[0]?.date ?? fallbackDate,
    entities,
    lines: parsed,
    amountDueCents,
    alerts: parsed.filter((line) => line.alert).length,
  };
}

export function claimsFromInvoice(invoice: Invoice, clientId: string): Claim[] {
  return invoice.entities.map((entity, index) => {
    const lines = invoice.lines.filter((line) => line.entity === entity).map(toLine);
    const dos = lines.length > 0 ? invoice.lines.find((line) => line.entity === entity)?.date ?? invoice.date : invoice.date;
    return {
      id: `claim-${invoice.id}-${index}`,
      clientId,
      dos,
      pos: placeFor(lines),
      diagnosis: "",
      number: "",
      note: "",
      payer: "medicare",
      status: "draft",
      lines,
    };
  });
}

export function entityTotal(invoice: Invoice, entity: string) {
  const lines = invoice.lines.filter((line) => line.entity === entity && line.amountCents !== null);
  if (lines.length === 0) return null;
  return lines.reduce((sum, line) => sum + (line.amountCents ?? 0), 0);
}

function toLine(line: InvoiceLine): Line {
  return {
    id: line.id,
    code: line.code,
    modifier: line.modifier,
    units: 1,
    chargeCents: line.amountCents,
    allowedCents: line.allowedCents,
    schedule: line.note,
    note: `${line.entity}: ${line.service}`,
  };
}

function placeFor(lines: Line[]) {
  if (lines.some((line) => line.schedule.startsWith("Ambulance"))) return "41";
  if (lines.some((line) => line.schedule.startsWith("Clinical lab"))) return "81";
  return "12";
}

function verify(code: string, schedule: string, allowedCents: number | null, amountCents: number | null): Alert | null {
  if (schedule === "Not loaded" || schedule === "none" || schedule === "Physician file, not priced") {
    return {
      level: "high",
      reason: "This code is not on a loaded Olean file. Payment would wait until the code is confirmed.",
      expectedCode: code,
      expectedCents: null,
    };
  }
  if (amountCents === null) {
    return {
      level: "high",
      reason: "The invoice has no amount for this line. Payment would wait.",
      expectedCode: code,
      expectedCents: allowedCents,
    };
  }
  if (allowedCents !== null && Math.abs(amountCents - allowedCents) > 1) {
    return {
      level: "high",
      reason: "The claimed amount does not match the Rest of New York allowed amount.",
      expectedCode: code,
      expectedCents: allowedCents,
    };
  }
  return null;
}

function stripCodes(row: string) {
  return row.replace(CODE, "").replace(DATE, "").replace(MONEY, "").replace(/[$,]/g, " ").replace(/\s+/g, " ").trim() || "Service on the invoice";
}

function normalizeDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.split("/");
  if (parts.length !== 3) return value;
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
}

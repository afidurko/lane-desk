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

/** Read code, date, and amount. Words on the line are ignored. */
export function readInvoiceLines(raw: string): CheckLine[] {
  const text = raw.replace(/^\uFEFF/, "");
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
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

function yearOf(date: string) {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return year >= 2020 && year <= 2026 ? year : null;
}

function normalize(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.split("/");
  if (parts.length !== 3) return "";
  const month = parts[0].padStart(2, "0");
  const day = parts[1].padStart(2, "0");
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${month}-${day}`;
}

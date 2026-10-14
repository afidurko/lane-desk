import { CODE_TYPES, payLine } from "@/lib/lookup/code-types";

/** The client workbook. Column order is the sheet that was sent. A blank cell is not zero. */
export const CLIENT_COLUMNS = [
  "CLAIM TYPE",
  "FACILITY",
  "YEAR",
  "DATE OF SERVICE",
  "SCHDULE",
  "CPT CODE",
  "MODIFIER",
  "FACTOR",
  "UNITS",
  "CPT CODE LOOKUP",
  "GROSS",
  "BLANK",
  "PROVIDER BILLED",
  "GROSS",
  "COLLABRIOS WANT TO PAY",
  "I WANT TO PAY",
  "SEQ RATE",
  "PAY WITH SEQ",
  "DIFF",
  "BLANK",
  "DESCRIPTION",
  "FLAG",
] as const;

const HEADER = [
  ["CLAIM", "FACILITY"],
  ["TYPE", "TYPE"],
  ["", "", "", "", "", "", "", "", "", "CPT", "", "", "", "", "COLLABRIOS", "I WANT", "", "PAY WITH"],
  ["", "", "", "DATE OF", "SCHDULE", "CPT", "MODIFIER", "", "UNITS", "CODE", "GROSS", "", "PROVIDER", "GROSS", "WANT TO", "TO", "", "SEQ", "DIFF", "", "DESCRIPTION", "FLAG"],
  ["", "", "", "SERVICE", "", "CODE", "", "", "", "LOOKUP", "", "", "BILLED", "", "PAY", "PAY"],
];

const SCHEDULE: Record<string, string> = {
  dme: "DME",
  pfs: "PFS",
  lab: "LAB",
  opps: "OPPS",
  ambulance: "AMBULANCE",
  miles: "MILEAGE",
  nursing: "NURSING",
};

export type SheetLine = {
  code: string;
  modifier: string;
  date: string;
  year: number | null;
  units: number | null;
  setting: "nf" | "fac" | null;
  claim?: "professional" | "institutional" | "other" | null;
  schedule: string | null;
  lookupCents: number | null;
  billedCents: number | null;
  adminCents: number | null;
  seqRate: number | null;
  fileCents: number | null;
  otherCents: number | null;
  name: string;
  block: string | null;
  note?: string | null;
};

export type Compared = {
  flag: "Match" | "Wrong schedule" | "Lookup does not match" | "Their amount does not match" | "Unknown";
  lookup: number | null;
  file: number | null;
  want: number | null;
  theirs: number | null;
  youPay: number | null;
  diff: number | null;
  why: string;
};

export function compareLine(line: SheetLine): Compared {
  const units = typeof line.units === "number" && Number.isFinite(line.units) && line.units > 0 ? line.units : null;
  const file = typeof line.fileCents === "number" && Number.isFinite(line.fileCents) ? line.fileCents : null;
  const pay = payLine({
    fileCents: file,
    units,
    seqRate: line.seqRate,
    adminCents: line.adminCents,
    otherCents: line.otherCents,
  });
  const lookup = typeof line.lookupCents === "number" && Number.isFinite(line.lookupCents) ? line.lookupCents : null;
  const want = file !== null && units !== null ? Math.round(file * units) : null;
  const base = { lookup, file, want, theirs: pay.theirs, youPay: pay.payable, diff: pay.gap };
  if (file === null || units === null) {
    return { ...base, youPay: null, diff: null, flag: "Unknown", why: line.block?.trim() || `${line.code} is unknown for this year. No amount was used.` };
  }
  if (pay.wrong) {
    return { ...base, flag: "Wrong schedule", why: `${line.code}. They want ${dollars(pay.theirs)}. The file${line.seqRate ? ` after ${line.seqRate}` : ""} is ${dollars(pay.payable)}. The other schedule was used.` };
  }
  if (lookup !== null && Math.abs(lookup - file) > 1) {
    return { ...base, flag: "Lookup does not match", why: `${line.code}. Their lookup is ${dollars(lookup)} per unit. The file is ${dollars(file)} per unit.` };
  }
  const charge = typeof line.billedCents === "number" && Number.isFinite(line.billedCents) && line.billedCents > 0 ? line.billedCents : null;
  if (pay.gap !== null && Math.abs(pay.gap) > 1) {
    return { ...base, flag: "Their amount does not match", why: `${line.code}. They want ${dollars(pay.theirs)}. You pay ${dollars(pay.payable)}.` };
  }
  if (pay.theirs === null && charge !== null && want !== null && Math.abs(charge - want) > 1) {
    return { ...base, theirs: charge, diff: (pay.payable ?? want) - charge, flag: "Their amount does not match", why: `${line.code}. The charge is ${dollars(charge)}. The file is ${dollars(want)}.` };
  }
  return { ...base, flag: "Match", why: line.note ? `${line.code} matches the file. ${line.note}` : `${line.code} matches the file.` };
}

/** The order of the decision. An older year is not a step that sets the price. */
export function reasonChain(line: SheetLine) {
  const compared = compareLine(line);
  const steps = [profileOf(line)];
  steps.push(line.year ? `Year ${line.year}. An older year is not used.` : "No year on the line, so it cannot be priced.");
  if (line.setting === "fac") steps.push("The line says facility. The office amount is not used.");
  else if (line.setting === "nf") steps.push("The line says office.");
  else if (line.schedule === "pfs") steps.push("The line does not say facility.");
  if (line.block) steps.push(line.block);
  else if (line.fileCents !== null) steps.push(`The file is ${dollars(line.fileCents)} per unit.`);
  if (line.note && !steps.some((step) => step.includes(line.note ?? ""))) steps.push(line.note);
  if (compared.youPay !== null) steps.push(`You pay ${dollars(compared.youPay)}.`);
  if (compared.theirs !== null) steps.push(`They want ${dollars(compared.theirs)}.`);
  if (!steps.includes(compared.why)) steps.push(compared.why);
  return steps;
}

export function profileOf(line: Pick<SheetLine, "code" | "modifier" | "claim" | "setting" | "schedule">) {
  const claim = line.claim === "professional" ? "Professional" : line.claim === "institutional" ? "Institutional" : line.claim === "other" ? "Other" : "";
  const place = line.setting === "fac" ? "Facility" : line.setting === "nf" ? "Office" : "";
  return [line.modifier ? `${line.code}-${line.modifier}` : line.code, claim, place, scheduleName(line.schedule)].filter(Boolean).join(" · ");
}

export function reportRows(lines: SheetLine[]) {
  const compared = lines.map((line) => ({ line, ...compareLine(line) }));
  const flagged = compared.filter((row) => row.flag !== "Match");
  const you = compared.reduce((sum, row) => sum + (row.youPay ?? 0), 0);
  const them = compared.reduce((sum, row) => sum + (row.theirs ?? 0), 0);
  const gap = flagged.reduce((sum, row) => sum + (row.diff ?? 0), 0);
  const count = (flag: Compared["flag"]) => compared.filter((row) => row.flag === flag).length;
  return { compared, flagged, you, them, gap, count };
}

export type Roll = { name: string; lines: number; you: number; them: number; diff: number; flagged: number };

/** Dollars by year and by file. A year or a file with no lines is left out. */
export function rollsFor(lines: SheetLine[]) {
  const rows = lines.map((line) => ({ line, ...compareLine(line) }));
  const pack = (key: (line: SheetLine) => string) => {
    const map = new Map<string, Roll>();
    for (const row of rows) {
      const name = key(row.line);
      if (!name) continue;
      const slot = map.get(name) ?? { name, lines: 0, you: 0, them: 0, diff: 0, flagged: 0 };
      slot.lines += 1;
      slot.you += row.youPay ?? 0;
      slot.them += row.theirs ?? 0;
      slot.diff += row.diff ?? 0;
      if (row.flag !== "Match") slot.flagged += 1;
      map.set(name, slot);
    }
    return [...map.values()];
  };
  return {
    years: pack((line) => (line.year === null ? "" : String(line.year))).sort((a, b) => a.name.localeCompare(b.name)),
    files: pack((line) => scheduleName(line.schedule)),
  };
}

/** Workbook bytes. The first sheet is the form a person reads. Source keeps the client columns. Report is the comparison. A blank cell is not zero. */
export function clientWorkbook(lines: SheetLine[]) {
  const report = reportRows(lines);
  const rolls = rollsFor(lines);
  const body = lines.map((line) => lineRow(line, compareLine(line)));
  const rollRows: (string | number | null)[][] = [];
  if (rolls.years.length > 1) {
    rollRows.push([], ["Year", "Lines", "You pay", "They want", "Difference", "Flagged"], ...rolls.years.map((roll) => [roll.name, String(roll.lines), roll.you / 100, roll.them / 100, roll.diff / 100, String(roll.flagged)]));
  }
  if (rolls.files.length > 1) {
    rollRows.push([], ["File", "Lines", "You pay", "They want", "Difference", "Flagged"], ...rolls.files.map((roll) => [roll.name, String(roll.lines), roll.you / 100, roll.them / 100, roll.diff / 100, String(roll.flagged)]));
  }
  const detail = [
    ["Lane comparison"],
    ["Lines", String(lines.length)],
    ["Match", String(report.count("Match"))],
    ["Wrong schedule", String(report.count("Wrong schedule"))],
    ["Lookup does not match", String(report.count("Lookup does not match"))],
    ["Their amount does not match", String(report.count("Their amount does not match"))],
    ["Unknown", String(report.count("Unknown"))],
    ["You pay", report.compared.some((row) => row.youPay !== null) ? report.you / 100 : ""],
    ["They want to pay", report.compared.some((row) => row.theirs !== null) ? report.them / 100 : ""],
    ["Difference on flagged lines", report.flagged.length ? report.gap / 100 : ""],
    ...rollRows,
    [],
    ["Code", "Date", "Year", "Schedule", "Units", "Their lookup", "File per unit", "They want to pay", "You pay", "Difference", "Flag", "Why"],
    ...report.flagged.map((row) => [
      row.line.code,
      row.line.date,
      row.line.year === null ? "" : String(row.line.year),
      scheduleName(row.line.schedule),
      row.line.units === null ? "" : String(row.line.units),
      moneyCell(row.lookup),
      moneyCell(row.file),
      moneyCell(row.theirs),
      moneyCell(row.youPay),
      moneyCell(row.diff),
      row.flag,
      safeText(row.why),
    ]),
  ];
  const headerAt = detail.findIndex((row) => row[0] === "Code");
  const form = formRows(lines, report);
  const formHeader = form.findIndex((row) => row[0] === "Code") + 1;
  const formLast = formHeader + lines.length;
  return zipStore([
    { name: "[Content_Types].xml", data: text(CONTENT_TYPES) },
    { name: "_rels/.rels", data: text(RELS) },
    { name: "xl/workbook.xml", data: text(WORKBOOK) },
    { name: "xl/_rels/workbook.xml.rels", data: text(WORKBOOK_RELS) },
    { name: "xl/styles.xml", data: text(STYLES) },
    { name: "xl/worksheets/sheet1.xml", data: text(sheetXml(form, { money: [7, 8, 9, 10, 11], flag: 12, why: 13, split: formHeader, headerRow: formHeader, bodyEnd: formLast, widths: [14, 28, 14, 10, 12, 18, 10, 16, 16, 12, 16, 14, 28, 56], merges: ["A2:N2", "A3:N3"], filterEnd: formLast, title: true })) },
    { name: "xl/worksheets/sheet2.xml", data: text(sheetXml([...HEADER, [], ...body], { money: [9, 10, 12, 13, 14, 15, 17, 18], flag: 21, split: 6, widths: [18, 16, 10, 16, 14, 12, 12, 10, 10, 16, 12, 8, 16, 12, 18, 14, 12, 14, 12, 8, 28, 24] })) },
    { name: "xl/worksheets/sheet3.xml", data: text(sheetXml(detail, { money: [1, 2, 3, 4, 5, 6, 7, 8, 9], flag: 10, why: 11, split: headerAt + 1, headerRow: headerAt + 1, widths: [28, 14, 14, 14, 14, 14, 16, 16, 14, 14, 28, 72], title: true })) },
  ]);
}

function formRows(lines: SheetLine[], report: ReturnType<typeof reportRows>): (string | number | null)[][] {
  const unknown = report.count("Unknown");
  const mismatch = report.flagged.length - unknown;
  const match = report.count("Match");
  const anyYou = report.compared.some((row) => row.youPay !== null);
  const anyThem = report.compared.some((row) => row.theirs !== null);
  const anyDiff = report.flagged.some((row) => row.diff !== null);
  const summary = [
    `${lines.length} ${lines.length === 1 ? "line" : "lines"}.`,
    `${match} match.`,
    `${mismatch} do not match.`,
    `${unknown} unknown.`,
    anyYou ? `You would pay ${dollars(report.you)}.` : "You would pay no amount.",
    anyThem ? `They want to pay ${dollars(report.them)}.` : "They did not name an amount.",
    anyDiff ? `Difference ${dollars(report.gap)}.` : "No difference to add.",
    unknown > 0 ? "Unknown lines were not added." : "",
  ].filter(Boolean).join(" ");
  return [
    ["Lane"],
    ["Each line is next to the posted amount. A blank was not guessed. Nothing was sent."],
    [summary],
    ["Code", "What it is", "Date", "Year", "Place", "Which file", "Units", "Posted per unit", "They want to pay", "Charge", "You would pay", "Difference", "Result", "Why"],
    ...lines.map((line) => formLine(line, compareLine(line))),
    [],
    ["Lines", String(lines.length)],
    ["Match", String(match)],
    ["Does not match", String(mismatch)],
    ["Unknown", String(unknown)],
    ["You would pay", anyYou ? report.you / 100 : ""],
    ["They want to pay", anyThem ? report.them / 100 : ""],
    ["Difference", anyDiff ? report.gap / 100 : ""],
  ];
}

function formLine(line: SheetLine, compared: Compared): (string | number | null)[] {
  const units = line.units && line.units > 0 ? line.units : null;
  const place = line.setting === "fac" ? "Facility" : line.setting === "nf" ? "Office" : "";
  return [
    line.modifier ? `${line.code}-${line.modifier}` : line.code,
    safeText(line.name || line.code),
    line.date,
    line.year,
    place,
    formFile(line.schedule),
    units,
    moneyNumber(compared.file),
    moneyNumber(compared.theirs),
    moneyNumber(line.billedCents),
    moneyNumber(compared.youPay),
    moneyNumber(compared.diff),
    compared.flag,
    safeText(compared.why),
  ];
}

function lineRow(line: SheetLine, compared: Compared): (string | number | null)[] {
  const units = line.units && line.units > 0 ? line.units : null;
  return [
    "",
    line.setting === "fac" ? "FACILITY" : line.setting === "nf" ? "NON FACILITY" : "",
    line.year,
    line.date,
    scheduleName(line.schedule),
    line.code,
    line.modifier,
    null,
    units,
    moneyNumber(line.lookupCents),
    moneyNumber(line.lookupCents),
    null,
    moneyNumber(line.billedCents),
    moneyNumber(line.billedCents),
    moneyNumber(line.adminCents),
    moneyNumber(compared.want),
    line.seqRate,
    moneyNumber(compared.youPay),
    moneyNumber(compared.diff),
    null,
    safeText(line.name || line.code),
    compared.flag === "Match" ? "Match" : compared.flag,
  ];
}

function scheduleName(schedule: string | null) {
  if (!schedule || schedule === "none" || schedule === "other") return "";
  return SCHEDULE[schedule] ?? schedule;
}

function formFile(schedule: string | null) {
  if (!schedule || schedule === "none" || schedule === "other") return "";
  return CODE_TYPES.find((type) => type.id === schedule)?.name ?? scheduleName(schedule);
}

function moneyNumber(cents: number | null) {
  return cents === null ? null : Math.round(cents) / 100;
}

function moneyCell(cents: number | null) {
  return cents === null ? "" : Math.round(cents) / 100;
}

function dollars(cents: number | null) {
  return cents === null ? "no amount" : `$${(cents / 100).toFixed(2)}`;
}

function safeText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function sheetXml(rows: (string | number | null)[][], layout: { money: number[]; flag: number; why?: number; split: number; headerRow?: number; bodyEnd?: number; widths: number[]; merges?: string[]; filterEnd?: number; title?: boolean }) {
  const cols = layout.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const lastCol = columnName(layout.widths.length - 1);
  const lastRow = Math.max(rows.length, 1);
  const body = rows.map((row, index) => {
    const flag = row[layout.flag];
    const line = index + 1;
    const cells = row.map((value, column) => cellXml(line, column, value, styleFor(line, column, value, flag, layout))).filter(Boolean);
    const inBody = layout.bodyEnd !== undefined && layout.headerRow !== undefined && line > layout.headerRow && line <= layout.bodyEnd;
    const lead = layout.title === true && (line === 2 || line === 3);
    const tall = inBody || lead ? ` ht="36" customHeight="1"` : "";
    return `<row r="${line}"${tall}>${cells.join("")}</row>`;
  }).join("");
  const view = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${layout.split}" topLeftCell="A${layout.split + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  const filter = layout.filterEnd && layout.headerRow ? `<autoFilter ref="A${layout.headerRow}:${lastCol}${layout.filterEnd}"/>` : "";
  const merges = layout.merges && layout.merges.length > 0 ? `<mergeCells count="${layout.merges.length}">${layout.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  const sheetPr = `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`;
  const dimension = `<dimension ref="A1:${lastCol}${lastRow}"/>`;
  const page = `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.5" header="0.25" footer="0.25"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="1"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetPr}${dimension}${view}<cols>${cols}</cols><sheetData>${body}</sheetData>${filter}${merges}${page}</worksheet>`;
}

function styleFor(row: number, column: number, value: string | number | null, flag: string | number | null, layout: { money: number[]; flag: number; why?: number; headerRow?: number; bodyEnd?: number; title?: boolean }) {
  if (layout.headerRow && row === layout.headerRow) return 3;
  if (layout.title && row === 1 && column === 0) return 6;
  if (layout.title && (row === 2 || row === 3) && column === 0) return 7;
  if (layout.why !== undefined && column === layout.why) return 7;
  const bad = typeof flag === "string" && flag !== "Match" && flag !== "Result" && flag !== "FLAG" && flag !== "Flag";
  const unknown = flag === "Unknown";
  if (column === layout.flag && bad) return unknown ? 5 : 1;
  if (layout.bodyEnd && typeof value === "number" && column === 1 && row > layout.bodyEnd) return 2;
  if (typeof value === "number" && layout.money.includes(column)) return bad && !unknown ? 4 : 2;
  return 0;
}

function cellXml(row: number, column: number, value: string | number | null, style: number) {
  if (value === null || value === "") return "";
  const ref = `${columnName(column)}${row}`;
  const styled = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${styled}><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${styled}><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function columnName(index: number) {
  let name = "";
  let number = index + 1;
  while (number > 0) {
    const rest = (number - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return value.replace(/[&<>]/g, (char) => {
    if (char === "&") return "&" + "amp;";
    if (char === "<") return "&" + "lt;";
    return "&" + "gt;";
  });
}

function text(value: string) {
  return new TextEncoder().encode(value);
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Form" sheetId="1" r:id="rId1"/><sheet name="Source" sheetId="2" r:id="rId2"/><sheet name="Report" sheetId="3" r:id="rId4"/></sheets></workbook>`;
const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="$#,##0.00"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF123C38"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFF2EBD9"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF6E948C"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1D504B"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D504B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EFEA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>`;

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = text(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, file.data);
    const dir = new Uint8Array(46 + name.length);
    const directory = new DataView(dir.buffer);
    directory.setUint32(0, 0x02014b50, true);
    directory.setUint16(4, 20, true);
    directory.setUint16(6, 20, true);
    directory.setUint32(16, crc, true);
    directory.setUint32(20, file.data.length, true);
    directory.setUint32(24, file.data.length, true);
    directory.setUint16(28, name.length, true);
    directory.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);
    offset += local.length + file.data.length;
  }
  const directoryLength = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ending = new DataView(end.buffer);
  ending.setUint32(0, 0x06054b50, true);
  ending.setUint16(8, files.length, true);
  ending.setUint16(10, files.length, true);
  ending.setUint32(12, directoryLength, true);
  ending.setUint32(16, offset, true);
  const size = offset + directoryLength + end.length;
  const out = new Uint8Array(size);
  let cursor = 0;
  for (const part of [...parts, ...central, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

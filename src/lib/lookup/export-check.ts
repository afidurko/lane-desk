import { gradeLookup } from "@/lib/lookup/check";
import { payLine } from "@/lib/lookup/code-types";

export type ExportLine = {
  code: string;
  modifier: string;
  date: string;
  year: number | null;
  units: number | null;
  schedule: string | null;
  lookupCents: number | null;
  adminCents: number | null;
  seqRate: number | null;
  seqPayCents: number | null;
  fileCents: number | null;
  otherCents: number | null;
  fileLabel: string | null;
  block: string | null;
  note: string | null;
};

const HEAD = ["Code", "Modifier", "Date", "Year", "Units", "Schedule", "File amount", "You pay", "Their amount", "Other schedule", "Result", "Note"];

/** A spreadsheet of the check. Amounts stay blank when the file has no dollar. Nothing is sent. */
export function exportCheckCsv(lines: ExportLine[]) {
  const body = lines.map((line) => {
    const pay = payLine({ fileCents: line.fileCents, units: line.units, seqRate: line.seqRate, adminCents: line.adminCents, otherCents: line.otherCents });
    const report = gradeLookup({
      code: line.code,
      year: line.year,
      units: line.units,
      lookupCents: line.lookupCents,
      fileCents: line.fileCents,
      adminCents: line.adminCents,
      seqRate: line.seqRate,
      seqPayCents: line.seqPayCents,
      block: line.block,
      note: line.note,
      otherCents: line.otherCents,
    });
    return [
      line.code,
      line.modifier,
      line.date,
      line.year === null ? "" : String(line.year),
      line.units === null ? "" : String(line.units),
      line.schedule ?? "",
      dollars(line.fileCents),
      dollars(pay.payable),
      dollars(line.adminCents),
      dollars(line.otherCents),
      report.reasons[0] ?? "",
      [line.fileLabel, line.note].filter(Boolean).join(" "),
    ];
  });
  return [HEAD, ...body].map((row) => row.map(cell).join(",")).join("\n");
}

function dollars(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function cell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

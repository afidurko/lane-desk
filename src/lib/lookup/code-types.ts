import type { CheckLine } from "@/lib/lookup/check";

export type CodeTypeId = Exclude<CheckLine["schedule"], null>;

/** The file for that code type. Olean equipment is the rural row. No amount is stored here. */
export const CODE_TYPES: readonly { id: CodeTypeId; name: string; file: string }[] = [
  { id: "dme", name: "Equipment", file: "DMEPOS, New York rural. The non-rural row is a different schedule." },
  { id: "pfs", name: "Physician", file: "Medicare physician, Rest of New York, locality 99. A facility line does not use the office amount." },
  { id: "lab", name: "Lab", file: "Clinical laboratory fee schedule." },
  { id: "opps", name: "Hospital outpatient", file: "Outpatient amount for the quarter on the line. A later quarter is not used." },
  { id: "ambulance", name: "Ambulance", file: "Ambulance, Rest of New York, rural ground. Carrier 13282, locality 99." },
  { id: "miles", name: "Mileage", file: "Ground mileage, code A0425, Rest of New York rural. Another mileage code is not given that rate." },
  { id: "nursing", name: "Nursing", file: "New York Medicaid, only when that year is posted. An older rate is not used." },
  { id: "none", name: "No schedule named", file: "Not priced. The sheet left the schedule blank." },
  { id: "other", name: "No file for that name", file: "The schedule name is not a loaded file." },
];

export function payLine(input: {
  fileCents: number | null;
  units: number | null;
  seqRate: number | null;
  adminCents: number | null;
  otherCents: number | null;
}) {
  const units = input.units && input.units > 0 ? input.units : null;
  if (input.fileCents === null || units === null) return { payable: null as number | null, theirs: input.adminCents && input.adminCents > 0 ? input.adminCents : null, wrong: false, gap: null as number | null };
  const line = Math.round(input.fileCents * units);
  const payable = input.seqRate ? Math.round(line * input.seqRate) : line;
  const other = input.otherCents ? Math.round(input.otherCents * units) : null;
  const theirs = input.adminCents && input.adminCents > 0 ? input.adminCents : null;
  const wrong = theirs !== null && other !== null && Math.abs(theirs - other) <= 1 && Math.abs(theirs - payable) > 1;
  return { payable, theirs, wrong, gap: theirs === null ? null : payable - theirs };
}

export function typeRollup(lines: Array<{ schedule: CheckLine["schedule"] } & Parameters<typeof payLine>[0]>) {
  const groups = CODE_TYPES.map((type) => {
    const rows = lines.filter((line) => line.schedule === type.id);
    let payable = 0;
    let payableLines = 0;
    let theirs = 0;
    let theirLines = 0;
    let wrongGap = 0;
    let wrongLines = 0;
    for (const row of rows) {
      const pay = payLine(row);
      if (pay.payable !== null) {
        payable += pay.payable;
        payableLines += 1;
      }
      if (pay.theirs !== null) {
        theirs += pay.theirs;
        theirLines += 1;
      }
      if (pay.wrong && pay.gap) {
        wrongGap += pay.gap;
        wrongLines += 1;
      }
    }
    return { ...type, count: rows.length, payable, payableLines, theirs, theirLines, wrongGap, wrongLines };
  }).filter((type) => type.count > 0);
  const totals = groups.reduce(
    (sum, type) => ({
      payable: sum.payable + type.payable,
      theirs: sum.theirs + type.theirs,
      wrongGap: sum.wrongGap + type.wrongGap,
      wrongLines: sum.wrongLines + type.wrongLines,
      payableLines: sum.payableLines + type.payableLines,
    }),
    { payable: 0, theirs: 0, wrongGap: 0, wrongLines: 0, payableLines: 0 },
  );
  return { groups, totals };
}

import { compareLine, rollsFor, type Compared, type Roll, type SheetLine } from "@/lib/lookup/sheet-book";

const ORDER: Record<Compared["flag"], number> = {
  "Wrong schedule": 0,
  "Their amount does not match": 1,
  "Lookup does not match": 2,
  Unknown: 3,
  Match: 4,
};

const SCHEDULE: Record<string, string> = {
  dme: "Equipment",
  pfs: "Physician",
  lab: "Lab",
  opps: "Hospital outpatient",
  ambulance: "Ambulance",
  miles: "Mileage",
  nursing: "Nursing",
};

export type Paper = {
  lines: number;
  priced: number;
  unknown: number;
  youPay: number;
  theirs: number;
  difference: number;
  wrongLines: number;
  wrongCents: number;
  years: number[];
  schedules: { id: string; name: string }[];
  settings: { office: number; facility: number };
  rolls: { years: Roll[]; files: Roll[] };
  exceptions: { line: SheetLine; compared: Compared; impact: number }[];
  steps: { name: string; did: string; didNot: string }[];
};

/** Read, price, and flag. A blank file amount stays blank. */
export function workpaper(lines: SheetLine[]): Paper {
  const compared = lines.map((line) => ({ line, compared: compareLine(line) }));
  const priced = compared.filter((row) => row.compared.youPay !== null);
  const unknown = compared.filter((row) => row.compared.flag === "Unknown");
  const wrong = compared.filter((row) => row.compared.flag === "Wrong schedule");
  const youPay = priced.reduce((sum, row) => sum + (row.compared.youPay ?? 0), 0);
  const theirs = compared.reduce((sum, row) => sum + (row.compared.theirs ?? 0), 0);
  const difference = compared.reduce((sum, row) => sum + (row.compared.diff ?? 0), 0);
  const wrongCents = wrong.reduce((sum, row) => sum + (row.compared.diff ?? 0), 0);
  const years = [...new Set(lines.flatMap((line) => (line.year === null ? [] : [line.year])))].sort((a, b) => a - b);
  const scheduleIds = [...new Set(lines.flatMap((line) => (line.schedule && SCHEDULE[line.schedule] ? [line.schedule] : [])))];
  const office = priced.filter((row) => row.line.setting === "nf").reduce((sum, row) => sum + (row.compared.youPay ?? 0), 0);
  const facility = priced.filter((row) => row.line.setting === "fac").reduce((sum, row) => sum + (row.compared.youPay ?? 0), 0);
  const exceptions = compared
    .filter((row) => row.compared.flag !== "Match")
    .map((row) => ({ ...row, impact: Math.abs(row.compared.diff ?? 0) }))
    .sort((a, b) => ORDER[a.compared.flag] - ORDER[b.compared.flag] || b.impact - a.impact);
  const largest = exceptions.find((row) => row.impact > 0);
  return {
    lines: lines.length,
    priced: priced.length,
    unknown: unknown.length,
    youPay,
    theirs,
    difference,
    wrongLines: wrong.length,
    wrongCents,
    years,
    schedules: scheduleIds.map((id) => ({ id, name: SCHEDULE[id] ?? id })),
    settings: { office, facility },
    rolls: rollsFor(lines),
    exceptions,
    steps: [
      { name: "Read", did: `Read ${lines.length} ${lines.length === 1 ? "line" : "lines"}.`, didNot: "A blank cell was not turned into zero." },
      { name: "Price", did: priced.length === 0 ? "No line had a file amount." : `Priced ${priced.length} from the file.`, didNot: unknown.length === 0 ? "Every priced line used the file for that year." : `${unknown.length} ${unknown.length === 1 ? "line has" : "lines have"} no file amount. No dollar was used.` },
      { name: "Except", did: exceptions.length === 0 ? "No line was flagged." : `Flagged ${exceptions.length}.${largest ? ` Largest is ${largest.line.code}.` : ""}`, didNot: "A match was not flagged. Nothing was sent." },
    ],
  };
}

export function selectLines(lines: SheetLine[], pick: { year: number | null; schedule: string | null; code?: string | null }) {
  return lines.filter((line) => (pick.year === null || line.year === pick.year) && (pick.schedule === null || line.schedule === pick.schedule) && (!pick.code || line.code === pick.code));
}

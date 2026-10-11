import { describeCode } from "@/lib/lookup/describe";
import { readInvoiceLines } from "@/lib/lookup/check";

export type YearRow = { n?: string; a?: Record<string, number | null>; s?: string };
export type StatusReport = { place?: string; files?: unknown[] };

export type Duty = {
  team: string;
  sub: string;
  name: string;
  ok: boolean;
  detail: string;
};

const PHYSICIAN_2026 = 2827;
const PHYSICIAN_2020 = 3047;
const AMBULANCE_2025 = 27709;

export function regulate(input: { physician: YearRow | null; ambulance: YearRow | null; status: StatusReport | null }): Duty[] {
  const physician = input.physician;
  const ambulance = input.ambulance;
  const p2026 = physician?.a?.["2026"];
  const p2020 = physician?.a?.["2020"];
  const a2025 = ambulance?.a?.["2025"];
  const told = physician ? describeCode("Physician", { n: physician.n ?? "", a: physician.a ?? {}, s: physician.s }) : "";
  const off = readInvoiceLines("97110 2026-03-01 30.00")[0];
  const match = readInvoiceLines("A0428 2025-06-12 277.09")[0];
  const place = input.status?.place ?? "";
  const files = input.status?.files?.length ?? 0;

  return [
    {
      team: "File",
      sub: "Physician",
      name: "97110 amounts",
      ok: physician?.n === "Therapeutic exercises" && p2026 === PHYSICIAN_2026 && p2020 === PHYSICIAN_2020,
      detail: physician ? `2026 ${shown(p2026)}, 2020 ${shown(p2020)}, ${physician.n || "no name"}.` : "The physician year file did not load.",
    },
    {
      team: "File",
      sub: "Ambulance",
      name: "A0428 amount",
      ok: a2025 === AMBULANCE_2025,
      detail: ambulance ? `2025 ${shown(a2025)}.` : "The ambulance year file did not load.",
    },
    {
      team: "Invoice",
      sub: "Mismatch",
      name: "Off amount is caught",
      ok: off?.code === "97110" && off.year === 2026 && off.billedCents === 3000 && typeof p2026 === "number" && Math.abs(off.billedCents - p2026) > 1,
      detail: off && typeof p2026 === "number" ? `Billed $30.00 against the 2026 file ${shown(p2026)}.` : "The invoice line did not parse.",
    },
    {
      team: "Invoice",
      sub: "Match",
      name: "Same amount passes",
      ok: match?.code === "A0428" && match.year === 2025 && match.billedCents === AMBULANCE_2025 && a2025 === AMBULANCE_2025,
      detail: match ? `Billed ${shown(match.billedCents)} against the 2025 file ${shown(a2025)}.` : "The ambulance invoice line did not parse.",
    },
    {
      team: "Code",
      sub: "Describe",
      name: "Description stays on the file",
      ok: told.includes("Therapeutic exercises") && told.includes("$28.27") && told.includes("$30.47"),
      detail: told ? "The description names the file wording and both years." : "There was no physician row to describe.",
    },
    {
      team: "Files",
      sub: "Status",
      name: "Status file is present",
      ok: place.includes("99") && files > 0,
      detail: files > 0 ? `${files} schedules. ${place}` : "The status file did not load.",
    },
  ];
}

function shown(cents: number | null | undefined) {
  if (typeof cents !== "number") return "missing";
  return `$${(cents / 100).toFixed(2)}`;
}

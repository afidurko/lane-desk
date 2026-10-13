import { AMBULANCE_NAMES, type AmbulanceFile } from "@/lib/book/ambulance";
import { payableStatus } from "@/lib/book/filter";
import { type DmeFile, type LabFile } from "@/lib/book/other";
import { conversionFor, localityDollars, notPricedInOffice, type PfsFile, type PfsRow } from "@/lib/book/price";

export type ScanChange = {
  schedule: "Physician" | "Ambulance" | "Lab" | "DME";
  code: string;
  name: string;
  prior: number | null;
  current: number | null;
  /** CMS non-facility NA on that year: not priced in the office setting. */
  priorNotOffice?: boolean;
  currentNotOffice?: boolean;
};

export type ScanCard = {
  schedule: ScanChange["schedule"];
  year: number;
  priorYear: number;
  rows: number;
  compared: number;
  changed: number;
  source: string;
};

const MAC = "13282";
const LOC = "99";

function dollarsToCents(dollars: number | null) {
  if (dollars === null || !(dollars > 0)) return null;
  return Math.round(dollars * 100);
}

function physicianCents(file: PfsFile, row: PfsRow) {
  if (notPricedInOffice(row)) return null;
  const locality = file.localities.find((item) => item.mac === MAC && item.number === LOC) ?? null;
  const conversion = conversionFor(row, "nonQp", file);
  if (!conversion) return null;
  return dollarsToCents(localityDollars(row, "nf", locality, conversion));
}

export function scanPhysician(current: PfsFile, prior: PfsFile): { card: ScanCard; changes: ScanChange[] } {
  const now = new Map(current.rows.filter((row) => row.m === "").map((row) => [row.c, row]));
  const then = new Map(prior.rows.filter((row) => row.m === "").map((row) => [row.c, row]));
  const codes = new Set([...now.keys(), ...then.keys()]);
  const changes: ScanChange[] = [];
  let compared = 0;
  for (const code of codes) {
    const currentRow = now.get(code);
    const priorRow = then.get(code);
    if (currentRow && !payableStatus(currentRow.s) && priorRow && !payableStatus(priorRow.s)) continue;
    if (!currentRow && priorRow && !payableStatus(priorRow.s)) continue;
    if (!priorRow && currentRow && !payableStatus(currentRow.s)) continue;
    compared += 1;
    const currentCents = currentRow ? physicianCents(current, currentRow) : null;
    const priorCents = priorRow ? physicianCents(prior, priorRow) : null;
    const currentNotOffice = Boolean(currentRow && notPricedInOffice(currentRow));
    const priorNotOffice = Boolean(priorRow && notPricedInOffice(priorRow));
    if (currentCents === priorCents && currentNotOffice === priorNotOffice) continue;
    changes.push({
      schedule: "Physician",
      code,
      name: currentRow?.d || priorRow?.d || code,
      prior: priorCents,
      current: currentCents,
      ...(priorNotOffice ? { priorNotOffice } : {}),
      ...(currentNotOffice ? { currentNotOffice } : {}),
    });
  }
  return {
    card: {
      schedule: "Physician",
      year: current.year,
      priorYear: prior.year,
      rows: current.rows.length,
      compared,
      changed: changes.length,
      source: current.source,
    },
    changes,
  };
}

export function scanAmbulance(current: AmbulanceFile, prior: AmbulanceFile): { card: ScanCard; changes: ScanChange[] } {
  const now = current.rows.filter((row) => row.carrier === MAC && row.loc === LOC);
  const then = new Map(prior.rows.filter((row) => row.carrier === MAC && row.loc === LOC).map((row) => [row.c, row.rural]));
  const changes: ScanChange[] = [];
  for (const row of now) {
    const priorCents = then.get(row.c) ?? null;
    if (row.rural === priorCents) continue;
    changes.push({
      schedule: "Ambulance",
      code: row.c,
      name: AMBULANCE_NAMES[row.c] ?? row.c,
      prior: priorCents,
      current: row.rural,
    });
  }
  return {
    card: {
      schedule: "Ambulance",
      year: current.year,
      priorYear: prior.year,
      rows: now.length,
      compared: now.length,
      changed: changes.length,
      source: current.source,
    },
    changes,
  };
}

export function scanLab(current: LabFile, prior: LabFile): { card: ScanCard; changes: ScanChange[] } {
  const then = new Map(prior.rows.map((row) => [`${row.c}|${row.m}`, row]));
  const changes: ScanChange[] = [];
  for (const row of current.rows) {
    const older = then.get(`${row.c}|${row.m}`);
    const priorCents = older?.rate ?? null;
    if (row.rate === priorCents) continue;
    changes.push({
      schedule: "Lab",
      code: row.m ? `${row.c}-${row.m}` : row.c,
      name: row.name,
      prior: priorCents,
      current: row.rate,
    });
  }
  return {
    card: {
      schedule: "Lab",
      year: current.year,
      priorYear: prior.year,
      rows: current.rows.length,
      compared: current.rows.length,
      changed: changes.length,
      source: `${current.release}. ${current.source}`,
    },
    changes,
  };
}

export function scanDme(current: DmeFile, prior: DmeFile): { card: ScanCard; changes: ScanChange[] } {
  const then = new Map(prior.rows.map((row) => [`${row.c}|${row.m}|${row.m2}`, row.rural]));
  const changes: ScanChange[] = [];
  for (const row of current.rows) {
    const priorCents = then.get(`${row.c}|${row.m}|${row.m2}`) ?? null;
    if (row.rural === priorCents) continue;
    changes.push({
      schedule: "DME",
      code: [row.c, row.m, row.m2].filter(Boolean).join(" "),
      name: row.name || "No description in the file.",
      prior: priorCents,
      current: row.rural,
    });
  }
  return {
    card: {
      schedule: "DME",
      year: current.year,
      priorYear: prior.year,
      rows: current.rows.length,
      compared: current.rows.length,
      changed: changes.length,
      source: `${current.release}. ${current.source}`,
    },
    changes,
  };
}

export function largestMoves(changes: ScanChange[], perSchedule = 2) {
  const schedules = ["Physician", "Ambulance", "Lab", "DME"] as const;
  const picked: ScanChange[] = [];
  for (const schedule of schedules) {
    const rows = changes.filter((row) => row.schedule === schedule && row.prior !== null && row.current !== null && row.prior > 0 && row.current > 0);
    rows.sort((left, right) => Math.abs((right.current ?? 0) - (right.prior ?? 0)) - Math.abs((left.current ?? 0) - (left.prior ?? 0)));
    picked.push(...rows.slice(0, perSchedule));
  }
  return picked;
}

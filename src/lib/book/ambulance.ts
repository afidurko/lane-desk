export const AMBULANCE_NAMES: Record<string, string> = {
  A0425: "Ground mileage, per statute mile",
  A0426: "ALS, non-emergency",
  A0427: "ALS, emergency",
  A0428: "BLS, non-emergency",
  A0429: "BLS, emergency",
  A0430: "Fixed wing air",
  A0431: "Rotary wing air",
  A0432: "Paramedic intercept",
  A0433: "ALS, level 2",
  A0434: "Specialty care transport",
  A0435: "Fixed wing mileage",
  A0436: "Rotary wing mileage",
};

export type AmbulanceRow = {
  carrier: string;
  loc: string;
  c: string;
  rvu: number;
  gpci: number;
  urban: number | null;
  rural: number | null;
  quartile: number | null;
  ruralMiles: number | null;
};

export type AmbulanceFile = {
  family: "ambulance";
  year: number;
  source: string;
  rows: AmbulanceRow[];
};

export function ambulancePlaces(file: AmbulanceFile) {
  const seen = new Map<string, { carrier: string; loc: string }>();
  for (const row of file.rows) {
    const key = `${row.carrier}/${row.loc}`;
    if (!seen.has(key)) seen.set(key, { carrier: row.carrier, loc: row.loc });
  }
  return [...seen.values()];
}

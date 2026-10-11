export type MoreRow = {
  family: string;
  c: string;
  name: string;
  fee: number | null;
  extra: number | null;
  asOf: string;
};

export type MoreFile = {
  family: "ny-more";
  source: string;
  rows: MoreRow[];
};

export function extraLabel(family: string) {
  if (family === "Private duty nursing") return "Downstate";
  if (family === "DME") return "Rental";
  if (family === "Doula") return "New York City";
  if (family === "Nurse practitioner" || family === "Vision" || family === "Hearing aid" || family === "Midwife") return "Facility";
  return "Other setting";
}

export function quotesMore(file: MoreFile, code: string) {
  const clean = code.trim().toUpperCase();
  return file.rows.filter((row) => row.c === clean);
}

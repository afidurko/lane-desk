export type NyPhysicianRow = {
  c: string;
  name: string;
  section: string;
  nf: number | null;
  fac: number | null;
  pc: number | null;
  base: number | null;
  br: boolean;
};

export type NyLabRow = { c: string; name: string; rate: number | null; br: boolean };

export type NyTransportRow = {
  county: string;
  category: string;
  c: string;
  m: string;
  fee: number | null;
  effective: string;
};

export type NyMedicaidFile = {
  family: "ny-medicaid";
  state: "NY";
  county: string;
  place: string;
  source: string;
  physician: { sections: { title: string; effective: string; rows: number }[]; rows: NyPhysicianRow[] };
  lab: { asOf: string; rows: NyLabRow[] };
  transport: { asOf: string; rows: NyTransportRow[] };
};

export const NY = {
  state: "New York",
  county: "CATTARAUGUS",
  place: "Olean",
  medicare: "Medicare, Rest of New York, MAC 13282, locality 99",
  medicaid: "New York Medicaid fee-for-service, eMedNY",
} as const;

export type NyQuote = { schedule: string; allowedCents: number | null; note: string };

export function countiesOf(file: NyMedicaidFile) {
  return [...new Set(file.transport.rows.map((row) => row.county))].sort();
}

export function quoteNy(file: NyMedicaidFile, code: string, county: string = NY.county): NyQuote {
  const clean = code.trim().toUpperCase();
  const trip = file.transport.rows.find((row) => row.county === county && row.c === clean && row.m === "");
  if (trip) {
    return {
      schedule: `NY Medicaid transportation, ${county}`,
      allowedCents: trip.fee,
      note: `${trip.category}. Effective ${trip.effective}. Fee-for-service file dated ${file.transport.asOf}.`,
    };
  }
  const physician = file.physician.rows.find((row) => row.c === clean);
  if (physician && (physician.nf !== null || physician.fac !== null || physician.pc !== null)) {
    const allowedCents = physician.nf ?? physician.fac ?? physician.pc;
    const which = physician.nf !== null ? "non-facility" : physician.fac !== null ? "facility" : "professional component";
    return {
      schedule: `NY Medicaid physician, ${which}`,
      allowedCents,
      note: `${physician.name}. ${physician.section}.`,
    };
  }
  const lab = file.lab.rows.find((row) => row.c === clean);
  if (lab) {
    return {
      schedule: "NY Medicaid laboratory",
      allowedCents: lab.rate,
      note: lab.br || lab.rate === null ? `${lab.name}. By report. No fee in the ${file.lab.asOf} file.` : `${lab.name}. ${file.lab.asOf}.`,
    };
  }
  if (physician?.base !== null && physician?.base !== undefined) {
    return { schedule: "NY Medicaid anesthesia", allowedCents: null, note: `${physician.name}. Base units ${physician.base}. The file has no dollar fee.` };
  }
  if (physician?.br) {
    return { schedule: "NY Medicaid physician", allowedCents: null, note: `${physician.name}. By report. No fee in the file.` };
  }
  return {
    schedule: "NY Medicaid",
    allowedCents: null,
    note: `Not on the loaded physician, laboratory, or ${county} transportation fee schedule.`,
  };
}

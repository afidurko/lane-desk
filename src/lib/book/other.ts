export type LabRow = {
  c: string;
  m: string;
  indicator: string;
  rate: number | null;
  name: string;
};

export type LabFile = {
  family: "lab";
  year: number;
  release: string;
  source: string;
  rows: LabRow[];
};

export type DmeRow = {
  c: string;
  m: string;
  m2: string;
  juris: string;
  cat: string;
  ceiling: number | null;
  floor: number | null;
  nr: number | null;
  rural: number | null;
  name: string;
};

export type DmeFile = {
  family: "dme";
  year: number;
  release: string;
  state: string;
  source: string;
  rows: DmeRow[];
};

/** What is loaded, how often it changes, and what is still missing. No file is fetched from here. */

export type UpdateRow = {
  name: string;
  cadence: string;
  loaded: string;
  next: string;
  gap: string | null;
};

export const UPDATES: readonly UpdateRow[] = [
  { name: "Physician fee schedule", cadence: "Annual, with quarterly corrections", loaded: "October files, 2020–2026", next: "January 2027", gap: null },
  { name: "Ambulance", cadence: "Annual", loaded: "2020–2026", next: "2027", gap: null },
  { name: "Clinical laboratory", cadence: "Quarterly", loaded: "Fourth quarter, 2020–2026", next: "First quarter 2027", gap: "January, April, and July quarters are not loaded." },
  { name: "DMEPOS", cadence: "Quarterly", loaded: "October, 2021–2026, New York rural and non-rural", next: "January 2027", gap: "2020 fee file was not in that year’s zip." },
  { name: "Part B drug ASP", cadence: "Quarterly", loaded: "October 2026", next: "January 2027", gap: "Only October through December 2026." },
  { name: "Hospital outpatient", cadence: "Quarterly", loaded: "October 2026 Addendum B", next: "January 2027", gap: "Only October through December 2026." },
  { name: "Ambulatory surgical center", cadence: "Quarterly", loaded: "October 2026 Addendum AA and BB", next: "January 2027", gap: "Only October through December 2026." },
  { name: "Inpatient PPS", cadence: "Fiscal year", loaded: "FY 2026 weights and national amounts", next: "FY 2027", gap: "Not wage-adjusted." },
  { name: "NY Medicaid fee-for-service", cadence: "As the Department posts", loaded: "Physician, lab, transport, dental, DME, and others", next: "Next posted file", gap: "Managed-care plan rates are not loaded." },
  { name: "NADAC", cadence: "Weekly", loaded: "Week of October 7, 2026", next: "Next weekly file", gap: "Acquisition cost, not a pharmacy payment." },
  { name: "Workers’ compensation dental and equipment", cadence: "As the Board posts", loaded: "Dental November 13, 2025. Equipment June 28, 2024.", next: "Next Board file", gap: "Physician and therapy schedules are sold." },
  { name: "Rehabilitation procedure 97110 on NY Medicaid", cadence: "Unknown", loaded: "Not loaded", next: "When a fee table is posted", gap: "The January 2026 PDF is a policy." },
  { name: "No-fault", cadence: "Unknown", loaded: "Not loaded", next: "When a free file is posted", gap: "No separate free fee file was found." },
] as const;

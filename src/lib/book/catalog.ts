export type PaymentSystem = {
  name: string;
  loaded: string | null;
  gap: string | null;
};

/** Medicare payment systems a claim can be paid under. Loaded means a CMS rate file is in this app. */
export const PAYMENT_SYSTEMS: readonly PaymentSystem[] = [
  { name: "Physician fee schedule", loaded: "October files, 2020–2026.", gap: null },
  { name: "Ambulance fee schedule", loaded: "Public use files, 2020–2026.", gap: null },
  { name: "Clinical laboratory fee schedule", loaded: "Fourth quarter, 2020–2026.", gap: null },
  { name: "DMEPOS fee schedule", loaded: "October files, 2021–2026. New York rural and non-rural.", gap: "2020 fee file was not in that year’s public zip." },
  { name: "Part B drug ASP", loaded: "October 2026 payment limit file, effective October 1 through December 31, 2026.", gap: null },
  { name: "Hospital outpatient PPS", loaded: "October 2026 Addendum B. A blank rate is not a separate payment.", gap: null },
  { name: "Ambulatory surgical center", loaded: "October 2026 Addendum AA and BB.", gap: null },
  { name: "Inpatient PPS", loaded: "FY 2026 MS-DRG weights and the national operating standardized amounts. Not wage-adjusted.", gap: null },
  { name: "Skilled nursing PPS", loaded: null, gap: "FY 2026 final rule updates the rates by 3.2 percent. The PDPM per-diem table was not in a file I could open." },
  { name: "Home health PPS", loaded: null, gap: "CY 2026 final rule describes the PDGM update. The case-mix weight table was not in a file I could open." },
  { name: "Hospice", loaded: "FY 2026 aggregate cap is $35,361.44. Rural New York wage index is 0.8892.", gap: "The per-day rates were not in the wage-index file." },
  { name: "Inpatient rehabilitation", loaded: null, gap: "FY 2026 final rule updates the rates by 2.6 percent. The case-mix group table was not in a file I could open." },
  { name: "Inpatient psychiatric", loaded: null, gap: "The per-diem table was not in a file I could open." },
  { name: "Long-term care hospital", loaded: null, gap: "FY 2026 is in the IPPS rule. The LTCH standard federal rate table was not in the files I opened." },
  { name: "ESRD PPS", loaded: "CY 2026 base rate is $281.71 per treatment, before wage index and other adjustments.", gap: null },
  { name: "FQHC PPS", loaded: null, gap: "The PPS page did not include a 2026 base-rate file." },
  { name: "Rural health clinic", loaded: null, gap: "The all-inclusive rate is set for each clinic. No national code file." },
  { name: "PACE capitation", loaded: null, gap: "Not a fee schedule. Not loaded." },
  { name: "Medicaid", loaded: "New York fee-for-service: physician, laboratory, transportation by county, plus DME, dental, nurse practitioner, podiatry, vision, hearing, midwife, private duty nursing, nutrition, doula, applied behavior analysis, ordered ambulatory, and rural hospice including Cattaraugus.", gap: "Other states and New York managed-care plan rates are not loaded." },
  { name: "NY Medicaid rehabilitation", loaded: null, gap: "January 2026 procedure policy. The posted PDF has no dollar table. 97110 is not in it." },
  { name: "NY Medicaid clinic", loaded: "APG fee-schedule procedures, July 1, 2026 column. Visit weights are not dollars.", gap: "A provider base rate was not in the file, so a weight cannot be turned into a visit price." },
  { name: "NY Medicaid personal care and home health", loaded: "Personal care agencies in Erie, Chautauqua, and Wyoming, January 1, 2025. Home health statewide visit rates, September 6, 2024.", gap: "Cattaraugus personal care is not in the posted file. Home health is a revenue-code visit rate, not procedure 97110." },
  { name: "NY Medicaid assisted living", loaded: "Olean Manor, January 1, 2025 rates by RUG category.", gap: null },
  { name: "NY Medicaid chiropractic", loaded: null, gap: "The manual is posted. It has no dollar table." },
  { name: "NADAC", loaded: "Week of October 7, 2026. Acquisition cost per unit, not a pharmacy payment.", gap: null },
  { name: "NY workers' compensation", loaded: "Dental fee schedule effective November 13, 2025, and durable medical equipment fee schedule effective June 28, 2024. Other specialties are sold and not loaded.", gap: null },
  { name: "NY no-fault", loaded: null, gap: "No separate free fee file was found. The workers' compensation files are not used as no-fault rates." },
  { name: "Medicare Advantage", loaded: null, gap: "Plan rates are not a CMS fee schedule. Not loaded." },
];

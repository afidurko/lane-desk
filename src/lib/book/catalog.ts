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
  { name: "Inpatient PPS", loaded: "FY 2021 through FY 2027 MS-DRG weights and national operating standardized amounts. Not wage-adjusted.", gap: "FY 2020 file page was not found." },
  { name: "Skilled nursing PPS", loaded: "FY 2024 through FY 2027 PDPM component rates, urban and rural. Components on one row are not added together.", gap: "FY 2020 through FY 2023 rate files were not opened. Not wage-adjusted." },
  { name: "Home health PPS", loaded: "CY 2020 through CY 2026 PDGM case-mix weights and LUPA thresholds. A weight is not a dollar.", gap: null },
  { name: "Hospice", loaded: "FY 2027 national per-day rates and the $36,174.75 cap. Rural New York wage index is loaded for FY 2024 through FY 2027.", gap: "The per-day rates are not wage-adjusted. The New York non-residential Medicaid sheet ended September 30, 2026. Residence rates for 2026 are posted by region, not by a Cattaraugus procedure code." },
  { name: "Inpatient rehabilitation", loaded: "FY 2020 and FY 2024 through FY 2027 case-mix group weights. A tier weight is not a dollar.", gap: "FY 2021 through FY 2023 were not opened. The standard payment conversion factor is not in the rate-setting file." },
  { name: "Inpatient psychiatric", loaded: "FY 2027 federal per diem base rate is $912.13. Comorbidity factors and the ECT rate are loaded. A factor is not a dollar.", gap: "Not wage-adjusted." },
  { name: "Long-term care hospital", loaded: "FY 2027 standard federal rate is $52,126.94. Table 11 weights are loaded. A published weight of 0.0000 is not stored.", gap: "Not wage-adjusted for one hospital." },
  { name: "ESRD PPS", loaded: "CY 2026 base rate is $281.71 per treatment, before wage index and other adjustments.", gap: null },
  { name: "FQHC PPS", loaded: "CY 2026 national base payment rate is $207.72, before the geographic adjustment factor.", gap: null },
  { name: "Rural health clinic", loaded: "CY 2026 payment limit is $165.00 per visit for an independent clinic and for a provider-based clinic in a hospital with 50 or more beds.", gap: "That is a limit, not one clinic’s all-inclusive rate." },
  { name: "PACE capitation", loaded: null, gap: "Not a fee schedule. Not loaded." },
  { name: "Medicaid", loaded: "New York fee-for-service: physician, laboratory, transportation by county, plus DME, dental, nurse practitioner, podiatry, vision, hearing, midwife, private duty nursing, nutrition, doula, applied behavior analysis, ordered ambulatory, and rural hospice including Cattaraugus.", gap: "Other states and New York managed-care plan rates are not loaded." },
  { name: "NY Medicaid rehabilitation", loaded: null, gap: "January 2026 procedure policy. The posted PDF has no dollar table. 97110 is not in it." },
  { name: "NY Medicaid clinic", loaded: "APG fee-schedule procedures, July 1, 2026 column. Visit weights are not dollars.", gap: "A provider base rate was not in the file, so a weight cannot be turned into a visit price." },
  { name: "NY Medicaid personal care and home health", loaded: "Olean is Cattaraugus County: Willcare, January 1, 2024. Allegany: Jan and Bev’s Home Care and Willcare, same date. Home health statewide visit rates, September 6, 2024.", gap: "The 2025 public personal-care sheet does not list Olean or Allegany. Home health is a visit rate, not procedure 97110." },
  { name: "NY Medicaid assisted living", loaded: "Olean Manor, January 1, 2025 rates by RUG category.", gap: null },
  { name: "NY Medicaid chiropractic", loaded: null, gap: "The manual is posted. It has no dollar table." },
  { name: "NADAC", loaded: "Week of October 7, 2026. Acquisition cost per unit, not a pharmacy payment.", gap: null },
  { name: "NY workers' compensation", loaded: "Dental fee schedule effective November 13, 2025, and durable medical equipment fee schedule effective June 28, 2024. Other specialties are sold and not loaded.", gap: null },
  { name: "NY no-fault", loaded: null, gap: "Regulation 83 points at the workers’ compensation schedules. The physician and therapy schedules are sold and are not loaded." },
  { name: "Medicare Advantage", loaded: null, gap: "Plan rates are not a CMS fee schedule. Not loaded." },
];

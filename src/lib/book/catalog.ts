import { NY_CARE_AFTER, NY_HOSPICE_AFTER, NY_REHAB_ABSENT, NY_SOLD_BOOKS } from "@/lib/ny/local";

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
  { name: "DMEPOS fee schedule", loaded: "October files, 2021–2026, and the 2020 CARES file. New York rural and non-rural.", gap: "October 2020 did not include a fee schedule. The loaded 2020 amounts are the CARES file, which that quarter did not replace. The July 2020 zip is not at the public file address." },
  { name: "Part B drug ASP", loaded: "October 2026 payment limit file, effective October 1 through December 31, 2026.", gap: null },
  { name: "Hospital outpatient PPS", loaded: "October 2026 Addendum B. A blank rate is not a separate payment.", gap: null },
  { name: "Ambulatory surgical center", loaded: "October 2026 Addendum AA and BB.", gap: null },
  { name: "Inpatient PPS", loaded: "FY 2020 through FY 2027 MS-DRG weights and national operating standardized amounts. Not wage-adjusted.", gap: null },
  { name: "Skilled nursing PPS", loaded: "FY 2020 through FY 2027 PDPM component rates, urban and rural. Components on one row are not added together.", gap: "Not wage-adjusted." },
  { name: "Home health PPS", loaded: "CY 2020 through CY 2026 PDGM case-mix weights and LUPA thresholds. A weight is not a dollar.", gap: null },
  { name: "Hospice", loaded: "FY 2020 through FY 2027 national per-day rates and caps. FY 2027 also has the rates for a hospice that does not submit quality data. Rural New York wage index is loaded for each of those years. The index is not a payment.", gap: `The per-day rates are not wage-adjusted. CMS-1851-CN confirmed the FY 2027 quality-data rates. ${NY_HOSPICE_AFTER}` },
  { name: "Inpatient rehabilitation", loaded: "FY 2020 through FY 2027 case-mix group weights. The standard payment conversion factor is $16,856 for FY 2021, $17,240 for FY 2022, and $17,878 for FY 2023.", gap: "A tier weight is not that dollar. The factor is not in the weight file for FY 2020 or FY 2024 through FY 2027." },
  { name: "Inpatient psychiatric", loaded: "FY 2027 federal per diem base rate is $912.13. Comorbidity factors and the ECT rate are loaded. A factor is not a dollar.", gap: "Not wage-adjusted." },
  { name: "Long-term care hospital", loaded: "FY 2027 standard federal rate is $52,126.94. Table 11 weights are loaded. A published weight of 0.0000 is not stored.", gap: "Not wage-adjusted for one hospital." },
  { name: "ESRD PPS", loaded: "CY 2026 base rate is $281.71 per treatment, before wage index and other adjustments.", gap: null },
  { name: "FQHC PPS", loaded: "CY 2026 national base payment rate is $207.72, before the geographic adjustment factor.", gap: null },
  { name: "Rural health clinic", loaded: "CY 2026 payment limit is $165.00 per visit for an independent clinic and for a provider-based clinic in a hospital with 50 or more beds.", gap: "That is a limit, not one clinic’s all-inclusive rate." },
  { name: "PACE capitation", loaded: null, gap: "Not a fee schedule. Not loaded." },
  { name: "Medicaid", loaded: "New York fee-for-service: physician, laboratory, transportation by county, plus DME, dental, nurse practitioner, podiatry, vision, hearing, midwife, private duty nursing, nutrition, doula, applied behavior analysis, ordered ambulatory, and rural hospice including Cattaraugus.", gap: "Other states and New York managed-care plan rates are not loaded." },
  { name: "NY Medicaid rehabilitation", loaded: null, gap: `The January 2026 rehabilitation fee schedule prices other codes, including 97530 at $18.05. ${NY_REHAB_ABSENT}` },
  { name: "NY Medicaid clinic", loaded: "APG fee-schedule procedures, July 1, 2026 column. Visit weights are not dollars.", gap: "A provider base rate was not in the file, so a weight cannot be turned into a visit price." },
  { name: "NY Medicaid personal care and home health", loaded: "January 1, 2024 personal care workbook, every county the sheet names. Home health statewide visit rates, September 6, 2024.", gap: `${NY_CARE_AFTER} A county is not given another county’s rate. Home health is a visit rate, not procedure 97110.` },
  { name: "NY Medicaid assisted living", loaded: "Olean Manor, January 1, 2025 rates by RUG category.", gap: null },
  { name: "NY Medicaid chiropractic", loaded: null, gap: "The manual is posted. It has no dollar table." },
  { name: "NADAC", loaded: "Week of October 7, 2026. Acquisition cost per unit, not a pharmacy payment.", gap: null },
  { name: "NY workers' compensation", loaded: "Dental fee schedule effective November 13, 2025, and durable medical equipment fee schedule effective June 28, 2024.", gap: NY_SOLD_BOOKS },
  { name: "NY no-fault", loaded: null, gap: NY_SOLD_BOOKS },
  { name: "Medicare Advantage", loaded: null, gap: "Plan rates are not a CMS fee schedule. Not loaded." },
];

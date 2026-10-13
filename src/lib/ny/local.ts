export type LocalRate = { level: string; cents: number };
export type LocalAgency = { name: string; rates: LocalRate[] };
export type LocalPlace = { place: string; county: string; countyCode: "CATTARAUGUS" | "ALLEGANY"; agencies: LocalAgency[] };

/** Posted New York Medicaid personal care rates, January 1, 2024. These two places are the ones this desk uses. */
export const LOCAL_CARE: readonly LocalPlace[] = [
  {
    place: "Olean",
    county: "Cattaraugus",
    countyCode: "CATTARAUGUS",
    agencies: [
      {
        name: "Willcare",
        rates: [
          { level: "Level one", cents: 3328 },
          { level: "Level two", cents: 3359 },
          { level: "Nursing supervision", cents: 12311 },
          { level: "Nursing assessment", cents: 12305 },
        ],
      },
    ],
  },
  {
    place: "Allegany",
    county: "Allegany",
    countyCode: "ALLEGANY",
    agencies: [
      {
        name: "Jan and Bev's Home Care",
        rates: [
          { level: "Level one", cents: 4032 },
          { level: "Level two", cents: 2187 },
          { level: "Nursing supervision", cents: 6864 },
        ],
      },
      {
        name: "Willcare",
        rates: [
          { level: "Level one", cents: 3349 },
          { level: "Level two", cents: 3380 },
          { level: "Nursing supervision", cents: 9283 },
        ],
      },
    ],
  },
];

export const LOCAL_AS_OF = "January 1, 2024";

/** Checked sheets. A missing New York amount is not filled from another file. */
export const NY_REHAB_ABSENT =
  "97110 and 97161 are not in the New York rehabilitation schedules for 2020, 2023, 2024, or January 2026, and they are not in the July 1, 2026 physician medicine workbook. Medicare Rest of New York still prices them. A separate IPSIDD sheet, effective April 1, 2024, lists remainder-of-state amounts: 97110 is $37.81 and 97161 is $83.72. Those rates are pending CMS approval of State Plan Amendment 24-0052, so they are not used as the rehabilitation amount. 97160 is not on that sheet and is not on the Medicare physician files for 2020 through 2026.";

export const NY_HOSPICE_AFTER =
  "New York Medicaid hospice after September 30, 2026 is not posted. The Department’s page still has no later non-residential sheet. The Western Rural residence rate of $257.41 is not used, because that sheet does not say Cattaraugus.";

export const NY_SOLD_BOOKS =
  "No-fault, and workers’ compensation physician and therapy, are not loaded. The August 2026 books are sold. No amount was copied.";

export const NY_CARE_AFTER =
  "Olean and Allegany personal care after 2024 stay on the January 1, 2024 amounts. The January 1, 2025 public sheet is posted. It does not name Cattaraugus, Allegany, Willcare, or Jan and Bev’s Home Care.";

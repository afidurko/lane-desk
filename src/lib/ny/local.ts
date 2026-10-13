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

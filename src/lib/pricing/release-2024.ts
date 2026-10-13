import { money } from "@/lib/desk/clock";
import { KEEP_TYPED_NY_AMOUNTS } from "@/lib/config/mode";

/**
 * 2024 is loaded from the year-end release (RVU24D). Dates of service from Jan 1 to Mar 8, 2024 used the
 * January release (RVU24A) and a lower conversion factor. Text only: this changes no price.
 * The example is Rest of New York, so it is kept in an internal build only (same rule as the therapy table).
 * scripts/price-regression.mjs checks the "now" figure against public/years/physician/9.json.
 */
export const EXAMPLE_2024 = { code: "97110", earlyCents: 2803, loadedCents: 2849 } as const;

const example = KEEP_TYPED_NY_AMOUNTS
  ? ` For example, 97110 Rest of New York was ${money(EXAMPLE_2024.earlyCents / 100)} then, against ${money(EXAMPLE_2024.loadedCents / 100)} here.`
  : "";

export const NOTE_2024 = `2024 prices use the year-end 2024 release. Services from January 1 through March 8, 2024 were priced from an earlier release with slightly lower amounts.${example}`;

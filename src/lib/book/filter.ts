export const STATUS_LABEL: Record<string, string> = {
  A: "Active. Priced on the physician schedule.",
  B: "Bundled. No separate physician amount.",
  C: "Contractor priced. No national amount.",
  E: "Excluded from the physician schedule.",
  I: "Not valid for Medicare on this schedule.",
  J: "Anesthesia. Base units plus time, not a flat amount.",
  M: "Reporting only. No payment.",
  N: "Non-covered.",
  P: "Bundled or excluded.",
  R: "Restricted coverage.",
  T: "Injections. Paid only in some settings.",
  X: "Statutory exclusion from the physician schedule.",
};

const TRANSPORT = new Set([
  "A0021", "A0080", "A0090", "A0100", "A0110", "A0120", "A0130", "A0140", "A0160", "A0170", "A0180", "A0190",
  "A0200", "A0210", "A0225", "A0380", "A0420", "A0422", "A0424", "A0425", "A0426", "A0427", "A0428", "A0429",
  "A0430", "A0431", "A0432", "A0433", "A0434", "A0435", "A0436", "A0888", "S0209", "S0215", "T2003", "T2004", "T2005",
]);

const TRANSPORT_WORDS = ["transport", "ambulance", "mileage", "wheelchair van"];

export function isProcedure(code: string) {
  return /^\d{5}$/.test(code) && Number(code) >= 10021 && Number(code) <= 69990;
}

export function isTransport(code: string, name: string) {
  const text = name.toLowerCase();
  return TRANSPORT.has(code) || TRANSPORT_WORDS.some((word) => text.includes(word));
}

export { payableStatus } from "@/lib/book/price";

/** What the Filter "Use" step (Add to claim) shows and puts on the claim when CMS gives a code no office price. */
export const NOT_OFFICE_USE_NOTE =
  "Not priced in the office setting. CMS has no office price for this code because it is rarely or never done in the office.";

export type FilterPick = { code: string; modifier: string; name: string; cents: number | null; notOffice: boolean };

/**
 * The claim line the Filter "Use" step adds. A code with no office price is added with no charge and no allowed amount,
 * and says so. It never takes another amount: not the typed Rest of New York therapy price, not any office price.
 */
export function claimLineFor(row: FilterPick, scheduleName: string, year: number) {
  if (row.notOffice) {
    return {
      line: {
        code: row.code,
        modifier: row.modifier,
        units: 1,
        chargeCents: null,
        allowedCents: null,
        schedule: "Physician file, not priced",
        note: NOT_OFFICE_USE_NOTE,
        year,
      },
      message: `${row.code}: Not priced in the office setting. No office amount was used.`,
    };
  }
  return {
    line: { code: row.code, modifier: row.modifier, units: 1, chargeCents: row.cents, allowedCents: row.cents, schedule: `${scheduleName}, ${year}`, note: row.name || row.code, year },
    message: null as string | null,
  };
}

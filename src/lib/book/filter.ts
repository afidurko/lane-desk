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

export function payableStatus(status: string) {
  return status === "A" || status === "R" || status === "T";
}

/**
 * A synthetic sample invoice built from the loaded fee file for the current mode.
 * Line 1 is billed at exactly the file amount. Line 2 is deliberately billed 10 percent over the file amount, so the demo has one
 * mismatch to show. The caller passes amounts that already include the therapy reduction (both lines are on one date).
 * No amount is typed in here.
 */
export function sampleInvoice(centsOf: (code: string) => number | undefined, year: number): { text: string; note: string } {
  const first = centsOf("97110");
  const second = centsOf("97140");
  if (typeof first !== "number" || typeof second !== "number") {
    throw new Error("The sample codes are not priced on the loaded file.");
  }
  const dollars = (cents: number) => (cents / 100).toFixed(2);
  const over = Math.round(second * 1.1);
  const text = ["Code,Date,Charge", `97110,${year}-03-02,${dollars(first)}`, `97140,${year}-03-02,${dollars(over)}`].join("\n");
  return {
    text,
    note: "Synthetic sample. The first line is billed at the file amount. The second is a therapy line on the same date, so Medicare's reduction applies to it, and it is deliberately billed 10 percent over that reduced amount so you can see a mismatch.",
  };
}

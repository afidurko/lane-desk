import type { National } from "@/lib/pricing/national";

/**
 * A synthetic sample invoice built from the loaded 2026 national file.
 * Line 1 is billed at exactly the file amount. Line 2 is deliberately billed 10 percent over,
 * so the demo has one mismatch to show. No amount is typed in here.
 */
export function sampleInvoice(national: National): { text: string; note: string } {
  const year = String(national.year);
  const pick = (code: string) => national.rows.get(code)?.a[year];
  const first = pick("97110");
  const second = pick("97140");
  if (typeof first !== "number" || typeof second !== "number") {
    throw new Error("The sample codes are not priced on the loaded file.");
  }
  const dollars = (cents: number) => (cents / 100).toFixed(2);
  const over = Math.round(second * 1.1);
  const text = ["Code,Date,Charge", `97110,${year}-03-02,${dollars(first)}`, `97140,${year}-03-02,${dollars(over)}`].join("\n");
  return {
    text,
    note: "Synthetic sample. The first line is billed at the file amount. The second is deliberately billed 10 percent over so you can see a mismatch.",
  };
}

import { AMBULANCE_NAMES } from "@/lib/book/ambulance";
import type { Books, Claim } from "@/lib/billing/billing";
import { checkLine } from "@/lib/billing/verify";
import type { NyMedicaidFile } from "@/lib/ny/medicaid";

const AMBULANCE = new Set(Object.keys(AMBULANCE_NAMES));

export type RoutineResult = {
  claim: Claim;
  changed: number;
  notes: string[];
};

/** Sets charges that already have a loaded amount, and place of service 41 when every line is ambulance. Does not guess a modifier, a diagnosis, or a claim number. */
export function safeFixes(claim: Claim, books: Books, ny: NyMedicaidFile | null = null): RoutineResult {
  if (claim.status !== "draft") {
    return { claim, changed: 0, notes: ["A ready claim is left alone. Return it to draft before a fix."] };
  }

  let changed = 0;
  const lines = claim.lines.map((line) => {
    const check = checkLine(line, books, claim.payer ?? "medicare", ny, claim.lines);
    if (check.expectedCents === null) return line;
    if (line.chargeCents !== null && Math.abs(line.chargeCents - check.expectedCents) <= 1) return line;
    changed += 1;
    // A therapy line keeps its full per-unit file amount; the claim applies the reduction across units.
    return { ...line, chargeCents: check.expectedCents, allowedCents: line.mppr ? line.allowedCents : check.expectedCents, dispute: "" };
  });

  const notes: string[] = [];
  let next: Claim = changed > 0 ? { ...claim, lines } : claim;
  if (changed === 1) notes.push("One charge was set to the file amount.");
  if (changed > 1) notes.push(`${changed} charges were set to the file amount.`);

  const codes = next.lines.map((line) => line.code.trim().toUpperCase());
  if ((claim.payer ?? "medicare") === "medicare" && codes.length > 0 && codes.every((code) => AMBULANCE.has(code)) && next.pos !== "41") {
    next = { ...next, pos: "41" };
    changed += 1;
    notes.push("Place of service set to 41. Every line is an ambulance code.");
  }

  if (notes.length === 0) {
    notes.push("Nothing on this claim can be fixed without a person. A modifier, a diagnosis, and a claim number are not guessed.");
  }
  return { claim: next, changed, notes };
}

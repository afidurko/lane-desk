import { allowedByLine, quoteCode, withReduction, type Books, type Claim, type Line } from "@/lib/billing/billing";
import { claimGuards, lineForGuard } from "@/lib/billing/guard";
import { quoteNy, type NyMedicaidFile } from "@/lib/ny/medicaid";

export type Check = {
  level: "high" | "clear";
  reason: string;
  expectedCode: string;
  expectedCents: number | null;
};

/**
 * Pass the other lines on the same claim (siblings) so the therapy reduction can rank the units.
 * Without them a line is checked alone, which is right for any line that is not therapy.
 * Optional county is used for New York Medicaid county fees. A county may also be passed in the siblings slot
 * (checkLine(line, books, "medicaid", ny, "ERIE")); a string there is the county, never a list of lines.
 */
export function checkLine(
  line: Line,
  books: Books,
  payer: "medicare" | "medicaid" = "medicare",
  ny: NyMedicaidFile | null = null,
  siblingsOrCounty: readonly Line[] | string = [line],
  countyArg?: string,
): Check {
  const siblings: readonly Line[] = typeof siblingsOrCounty === "string" ? [line] : siblingsOrCounty;
  const county = typeof siblingsOrCounty === "string" ? siblingsOrCounty : countyArg;
  if (payer === "medicaid") return checkMedicaid(line, ny, county);
  const quoted = quoteCode(books, line.code, line.modifier);
  if (quoted.mppr && quoted.allowedCents !== null && line.chargeCents !== null) {
    // The expected amount comes from the loaded file, never from the allowed amount typed on the line. Clear each
    // line's own allowed so withReduction fills it from the file; otherwise a stale charge copied into allowed
    // (a 2024 amount, say) would be "expected" and pass as clear.
    // A line that repeats a code and modifier already on the claim is not a second service, so it is not one of the
    // day's units. Price it by itself, or the reduction would be applied to it and the expected amount would be wrong.
    const duplicate = siblings.some((item) => item.id !== line.id && item.code === line.code && item.modifier === line.modifier);
    const group = duplicate ? [line] : siblings.some((item) => item.id === line.id) ? siblings : [...siblings, line];
    // The expected amount comes from the loaded file, never from the allowed amount typed on the line. Clear each
    // line's own allowed so withReduction fills it from the file; otherwise a stale charge copied into allowed
    // (a 2024 amount, say) would be "expected" and pass as clear.
    const day = withReduction(
      group.map((item) => ({ ...item, allowedCents: null })),
      books,
      payer,
    );
    const expectedTotal = allowedByLine(day)[line.id];
    if (expectedTotal !== null && expectedTotal !== undefined) {
      const chargeTotal = line.chargeCents * line.units;
      const perUnit = Math.round(expectedTotal / Math.max(1, line.units));
      if (Math.abs(chargeTotal - expectedTotal) > Math.max(1, line.units)) {
        return {
          level: "high",
          reason: "Charge does not match the Rest of New York allowed amount after the therapy multiple-procedure reduction.",
          expectedCode: line.code,
          expectedCents: perUnit,
        };
      }
      return { level: "clear", reason: "Matches the loaded file, with the therapy multiple-procedure reduction.", expectedCode: line.code, expectedCents: perUnit };
    }
  }
  if (quoted.schedule === "Physician file, not priced") {
    return { level: "high", reason: quoted.note || "This code is not separately payable.", expectedCode: line.code, expectedCents: null };
  }
  if (quoted.schedule === "Not loaded" || quoted.schedule === "none") {
    return { level: "high", reason: "Code is not on a loaded Olean file.", expectedCode: line.code, expectedCents: null };
  }
  if (line.chargeCents === null) {
    return { level: "high", reason: "No charge. Payment would wait.", expectedCode: line.code, expectedCents: quoted.allowedCents };
  }
  if (quoted.allowedCents !== null && line.chargeCents !== null) {
    const shaved = Math.round(quoted.allowedCents * 0.98);
    if (Math.abs(line.chargeCents - shaved) <= 1 && Math.abs(line.chargeCents - quoted.allowedCents) > 1) {
      return {
        level: "high",
        reason: "Do not reduce the charge for sequestration. The 2 percent cut comes out of the Medicare payment, not the fee on the file.",
        expectedCode: line.code,
        expectedCents: quoted.allowedCents,
      };
    }
  }
  if (quoted.allowedCents !== null && Math.abs(line.chargeCents - quoted.allowedCents) > 1) {
    return {
      level: "high",
      reason: "Charge does not match the Rest of New York allowed amount.",
      expectedCode: line.code,
      expectedCents: quoted.allowedCents,
    };
  }
  return { level: "clear", reason: "Matches the loaded file.", expectedCode: line.code, expectedCents: quoted.allowedCents };
}

function checkMedicaid(line: Line, ny: NyMedicaidFile | null, county?: string): Check {
  if (!ny) {
    return {
      level: "high",
      reason: "The New York Medicaid file is not loaded. The Medicare amount is not used in its place.",
      expectedCode: line.code,
      expectedCents: null,
    };
  }
  const quoted = quoteNy(ny, line.code, county);
  if (quoted.allowedCents === null) {
    return { level: "high", reason: quoted.note || "No New York Medicaid fee for this code.", expectedCode: line.code, expectedCents: null };
  }
  if (line.chargeCents === null) {
    return { level: "high", reason: "No charge. Payment would wait.", expectedCode: line.code, expectedCents: quoted.allowedCents };
  }
  if (Math.abs(line.chargeCents - quoted.allowedCents) > 1) {
    return {
      level: "high",
      reason: "Charge does not match the New York Medicaid fee-for-service amount.",
      expectedCode: line.code,
      expectedCents: quoted.allowedCents,
    };
  }
  return { level: "clear", reason: "Matches the New York Medicaid file.", expectedCode: line.code, expectedCents: quoted.allowedCents };
}

export function claimAlerts(claim: Claim, books: Books, today = "", ny: NyMedicaidFile | null = null, county?: string) {
  const payer = claim.payer ?? "medicare";
  const amount = claim.lines.map((line) => ({ line, check: checkLine(line, books, payer, ny, claim.lines, county) })).filter((item) => item.check.level === "high");
  const guards = claimGuards(claim, books, today).map((guard, index) => ({
    line: lineForGuard(claim, guard, index),
    check: {
      level: "high" as const,
      reason: guard.reason,
      expectedCode: guard.code,
      expectedCents: guard.expectedCents,
    },
  }));
  return [...guards, ...amount];
}

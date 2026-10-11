import { quoteCode, type Books, type Claim, type Line } from "@/lib/billing/billing";

export type Check = {
  level: "high" | "clear";
  reason: string;
  expectedCode: string;
  expectedCents: number | null;
};

export function checkLine(line: Line, books: Books): Check {
  const quoted = quoteCode(books, line.code, line.modifier);
  if (quoted.schedule === "Not loaded" || quoted.schedule === "none" || quoted.schedule === "Physician file, not priced") {
    return { level: "high", reason: "Code is not on a loaded Olean file.", expectedCode: line.code, expectedCents: null };
  }
  if (line.chargeCents === null) {
    return { level: "high", reason: "No charge. Payment would wait.", expectedCode: line.code, expectedCents: quoted.allowedCents };
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

export function claimAlerts(claim: Claim, books: Books) {
  return claim.lines.map((line) => ({ line, check: checkLine(line, books) })).filter((item) => item.check.level === "high");
}

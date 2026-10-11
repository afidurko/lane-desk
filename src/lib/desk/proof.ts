export type ProofStatus = "did-not-run" | "stop" | "hold" | "pass";

export type ProofReport = {
  name: "Proof";
  status: ProofStatus;
  job: "Decide whether this row can ship, name the next proof, and write the Kai brief";
  forbidden: "Cash, trading, career, code merges, full-platform talk";
  detail: string;
  nextProof: string;
};

const KILLS: { label: string; pattern: RegExp }[] = [
  { label: "Portal login", pattern: /\b(portal|password|username|log\s?in)\b/i },
  { label: "Scrape", pattern: /\bscrap(?:e|ing)\b/i },
  { label: "PE bid", pattern: /\b(term sheet|private equity|buy the book)\b/i },
  { label: "Unscoped platform", pattern: /\b(full ehr|replace the ehr|rip out the chart)\b/i },
];

export function proofIdle(): ProofReport {
  return {
    name: "Proof",
    status: "did-not-run",
    job: "Decide whether this row can ship, name the next proof, and write the Kai brief",
    forbidden: "Cash, trading, career, code merges, full-platform talk",
    detail: "Did not run.",
    nextProof: "None.",
  };
}

export function judgeProof(note: string, priced: boolean, timed: boolean): ProofReport {
  const base = {
    name: "Proof" as const,
    job: "Decide whether this row can ship, name the next proof, and write the Kai brief" as const,
    forbidden: "Cash, trading, career, code merges, full-platform talk" as const,
  };
  if (!priced && note.trim() === "") return proofIdle();
  if (!priced) {
    return {
      ...base,
      status: "stop",
      detail: "The note did not price. Scope stays on one encounter.",
      nextProof: "One de-identified note on the adult-day schedule. Not a second product.",
    };
  }
  const hit = KILLS.find((rule) => rule.pattern.test(note));
  if (hit) {
    return {
      ...base,
      status: "stop",
      detail: `${hit.label} is a stop. Proof does not open that scope.`,
      nextProof: "Return to one de-identified encounter. No portal, scrape, bid, or chart replacement.",
    };
  }
  if (!timed) {
    return {
      ...base,
      status: "hold",
      detail: "A demo that cannot be timed against a person does not ship.",
      nextProof: "Time your own seconds on this same note. No second encounter type.",
    };
  }
  return {
    ...base,
    status: "pass",
    detail: "The delta is this row only.",
    nextProof: "Another gold row of this same encounter type. Not a second encounter.",
  };
}

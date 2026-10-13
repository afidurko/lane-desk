/** Three jobs inside the bill. Names are the work, not people. */

export const FEE_TEAMS = [
  {
    id: "fee",
    name: "Fee management",
    does: "Holds the file for each code type and the amount for that year.",
    doesNot: "Does not invent a rate. Olean equipment stays on the rural file.",
  },
  {
    id: "finder",
    name: "Finder",
    does: "If a code is not on that file, looks through the other posted files and the saved lookups.",
    doesNot: "Does not keep searching once the code is unknown. Does not use another year’s rate.",
  },
  {
    id: "audit",
    name: "Audit",
    does: "Compares the correct amount, after 0.98 when the sheet has it, with what the other party wants to pay.",
    doesNot: "Does not send the bill. A person decides.",
  },
] as const;

export type FeeLine = {
  pricedCents: number | null;
  block: string | null;
  adminCents: number | null;
  wrongSchedule: boolean;
  gapCents: number | null;
};

export function feeTeamReport(lines: FeeLine[]) {
  const fee = lines.filter((line) => line.pricedCents !== null);
  const finder = lines.filter((line) => line.pricedCents === null);
  const audit = lines.filter((line) => line.adminCents !== null && line.adminCents > 0);
  const wrong = lines.filter((line) => line.wrongSchedule);
  const gap = wrong.reduce((sum, line) => sum + (line.gapCents ?? 0), 0);
  return {
    fee: { count: fee.length, detail: fee.length === 0 ? "No file amount on these lines." : `${fee.length} ${fee.length === 1 ? "line has" : "lines have"} a file amount.` },
    finder: { count: finder.length, detail: finder.length === 0 ? "Every line was on a file." : `${finder.length} ${finder.length === 1 ? "line is" : "lines are"} unknown. The search stopped.` },
    audit: {
      count: audit.length,
      wrong: wrong.length,
      gap,
      detail: wrong.length === 0 ? "No line used a different schedule." : `${wrong.length} ${wrong.length === 1 ? "line is" : "lines are"} on the wrong schedule.`,
    },
  };
}

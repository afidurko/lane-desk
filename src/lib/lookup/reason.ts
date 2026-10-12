import { money } from "@/lib/desk/clock";

export type FileFact = { cents: number; label: string; period?: string };

export function reasonLine(input: {
  code: string;
  year: number | null;
  billedCents: number | null;
  file: FileFact | null;
  priors?: { year: number; cents: number }[];
}) {
  if (!input.year) {
    return { verdict: "off" as const, steps: [`${input.code} has no year, so it cannot be priced.`] };
  }
  const steps = [`The line is ${input.code} in ${input.year}.`];
  if (!input.file) {
    steps.push("No loaded file has an amount for that year.");
    return { verdict: "off" as const, steps };
  }
  const period = input.file.period ? `, ${input.file.period}` : "";
  steps.push(`${input.file.label} for ${input.year} is ${money(input.file.cents / 100)}${period}.`);
  if (input.billedCents === null) {
    steps.push("The invoice has no amount, so it does not match.");
    return { verdict: "off" as const, steps };
  }
  const gap = input.billedCents - input.file.cents;
  steps.push(`The invoice billed ${money(input.billedCents / 100)}.`);
  const earlier = previousUse(input.priors ?? [], input.year, input.billedCents, input.file.cents);
  if (Math.abs(gap) <= 1) {
    steps.push(earlier ? `The difference is within one cent, so it matches. ${earlier}` : "The difference is within one cent, so it matches.");
    return { verdict: "match" as const, steps };
  }
  steps.push(`That is ${gap > 0 ? "over" : "under"} the file by ${money(Math.abs(gap) / 100)}, so it is off.`);
  if (earlier) steps.push(earlier);
  return { verdict: "off" as const, steps };
}

export function reasonMonth(input: {
  label: string;
  county: string;
  enrolled: boolean;
  gate: string | null;
  medicare: number | null;
  medicaid: number | null;
  esrd: boolean;
}) {
  if (!input.enrolled) {
    return [`${input.label} is not in the month. ${input.gate ?? "A gate is still open."}`];
  }
  const steps = [`${input.label} passed the enrollment gates, so the month counts them.`];
  if (input.esrd && input.medicare !== null) {
    steps.push(`ESRD replaces the county rate. Medicare is ${money(input.medicare / 100)}.`);
  } else if (input.medicare === null) {
    steps.push(`${input.county} has no Medicare amount in the loaded ratebook, so that side stays empty.`);
  } else {
    steps.push(`${input.county} Medicare for this year is ${money(input.medicare / 100)}.`);
  }
  if (input.medicaid === null) {
    steps.push("Medicaid is empty until a contract rate is entered. It is not taken from the Medicare file.");
  } else {
    steps.push(`Medicaid is the contract rate entered for ${input.county}, ${money(input.medicaid / 100)}.`);
  }
  const parts = [input.medicare, input.medicaid].filter((value): value is number => typeof value === "number");
  steps.push(parts.length === 0 ? "The month total skips this person because neither side has an amount." : `The person adds ${money(parts.reduce((sum, value) => sum + value, 0) / 100)}. Part D is not included.`);
  return steps;
}

/** An older year of the same code. The line year still wins. */
export function pricedYears(amounts: Record<string, number | null | undefined>) {
  return [2026, 2025, 2024, 2023, 2022, 2021, 2020].flatMap((year) => {
    const cents = amounts[String(year)];
    return typeof cents === "number" ? [{ year, cents }] : [];
  });
}

export function previousUse(
  priors: { year: number; cents: number }[],
  year: number,
  billedCents: number | null,
  fileCents: number,
) {
  const older = priors.filter((row) => row.year !== year && row.cents !== fileCents).sort((a, b) => b.year - a.year);
  if (older.length === 0) return null;
  const matched = billedCents === null ? null : older.find((row) => Math.abs(row.cents - billedCents) <= 1);
  if (matched) {
    return `That billed amount is the ${matched.year} amount for this code, ${money(matched.cents / 100)}. The line is ${year}, so the older amount is not used.`;
  }
  const nearest = older[0];
  return `In ${nearest.year} this code was ${money(nearest.cents / 100)}. That older amount is not used for ${year}.`;
}

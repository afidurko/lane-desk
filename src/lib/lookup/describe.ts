import { money } from "@/lib/desk/clock";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

const STATUS: Record<string, string> = {
  A: "Medicare lists it as active.",
  B: "It is bundled, so there is no separate amount.",
  C: "The contractor prices it. This file has no national amount.",
  E: "It is excluded from the physician schedule.",
  I: "It is not valid for Medicare on this schedule.",
  J: "It is anesthesia. Payment is base units plus time, not one flat amount.",
  M: "It is for reporting. It is not paid.",
  N: "It is non-covered.",
  P: "It is bundled or excluded.",
  R: "Coverage is restricted.",
  T: "It is an injection. It is paid only in some settings.",
  X: "It is excluded from the physician schedule by statute.",
};

export type Described = {
  n: string;
  a: Record<string, number | null>;
  s?: string;
};

export function describeCode(schedule: string, row: Described) {
  const name = row.n?.trim() || "This code";
  const where =
    schedule === "Physician"
      ? "It is on the physician schedule for Rest of New York, non-facility, locality 99."
      : schedule === "Ambulance"
        ? "It is an ambulance code for Rest of New York, rural."
        : schedule === "Lab"
          ? "It is on the clinical laboratory schedule. That amount is national."
          : "It is on the New York equipment schedule, rural.";
  const status = row.s ? STATUS[row.s] : "";
  const priced = YEARS.flatMap((year) => {
    const cents = row.a[String(year)];
    return typeof cents === "number" ? [{ year, cents }] : [];
  });
  let change = "The file does not give this code a separate amount in these years.";
  if (priced.length === 1) {
    change = `In ${priced[0].year} the amount is ${money(priced[0].cents / 100)}.`;
  } else if (priced.length > 1) {
    const newest = priced[0];
    const oldest = priced[priced.length - 1];
    const gap = newest.cents - oldest.cents;
    const moved =
      gap === 0
        ? `It is the same amount in ${oldest.year} and ${newest.year}.`
        : `From ${oldest.year} to ${newest.year} it is ${gap > 0 ? "up" : "down"} ${money(Math.abs(gap) / 100)}.`;
    change = `In ${newest.year} the amount is ${money(newest.cents / 100)}. In ${oldest.year} it was ${money(oldest.cents / 100)}. ${moved}`;
  }
  return [name + ".", where, status, change, "The name is the short description on the fee file."].filter(Boolean).join(" ");
}

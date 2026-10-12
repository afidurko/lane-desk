import { medicareCents } from "@/lib/pace/rates";

export const SEATS = [
  "Primary care provider",
  "Registered nurse",
  "Master's-level social worker",
  "Physical therapist",
  "Occupational therapist",
  "Recreational therapist or activity coordinator",
  "Dietitian",
  "PACE center manager",
  "Home care coordinator",
  "Personal care attendant or representative",
  "Driver or representative",
] as const;

export type Loc = "open" | "met" | "not";

export type Person = {
  id: string;
  label: string;
  county: string;
  medicare: boolean;
  medicaid: boolean;
  esrd: boolean;
  age55: boolean;
  inArea: boolean;
  voluntary: boolean;
  community: boolean;
  loc: Loc;
};

export function blockedText(text: string) {
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return "A Social Security number does not belong here.";
  if (/\d(?:[ -]?\d){8,}/.test(text)) return "A long number does not belong here.";
  return null;
}

export function gateGaps(person: Person) {
  const gaps: string[] = [];
  if (!person.age55) gaps.push("55 or older is not marked");
  if (!person.inArea) gaps.push("service area is not marked");
  if (!person.voluntary) gaps.push("enrollment is not marked voluntary");
  if (!person.community) gaps.push("safe in the community is not marked");
  if (person.loc !== "met") gaps.push("nursing-home level of care is not met");
  return gaps;
}

export function canEnroll(person: Person) {
  return gateGaps(person).length === 0;
}

export function monthLine(person: Person, year: number, medicaidCents: number | null) {
  const medicare = person.medicare || person.esrd ? medicareCents(person.county, year, person.esrd) : null;
  const medicaid = person.medicaid ? medicaidCents : null;
  const parts = [medicare, medicaid].filter((value): value is number => typeof value === "number");
  return {
    medicare,
    medicaid,
    total: parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) : null,
    missing: [
      person.medicare && !person.esrd && medicare === null ? "No Medicare county rate is loaded." : "",
      person.medicaid && medicaid === null ? "Medicaid needs the contract rate you enter. The state file is not public." : "",
      person.esrd && medicare === null ? "No ESRD rate is loaded for that year." : "",
    ].filter(Boolean),
  };
}

export function missingSeats(present: string[]) {
  return SEATS.filter((seat) => !present.includes(seat));
}

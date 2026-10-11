import { sequester } from "@/lib/book/price";

const OFFSET_STATUS = new Set(["J1", "J2", "P", "Q1", "Q2", "Q3", "R", "S", "S1", "T", "U", "V"]);
export const OFFSET_RATIO = 0.9951;
const MILEAGE = new Set(["A0425", "A0435", "A0436"]);

export function offsetApplies(status: string) {
  return OFFSET_STATUS.has(status);
}

export function isMileage(code: string) {
  return MILEAGE.has(code);
}

export function applyOffset(cents: number) {
  return Math.round(cents * 9951 / 10000);
}

export function lineMath(cents: number, units: number, offset: boolean, cut: boolean) {
  const base = cents * units;
  const allowedCents = offset ? applyOffset(base) : base;
  const picture = cut ? sequester(allowedCents / 100, 2) : null;
  return { baseCents: base, allowedCents, picture };
}

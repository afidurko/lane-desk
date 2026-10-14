/** Facility places in Medicare Claims Processing Manual, chapter 12, section 20.4.2. Locality 99 is not a place. */
const FACILITY_POS = new Set(["02", "19", "21", "22", "23", "24", "26", "31", "34", "41", "42", "51", "52", "53", "56", "61"]);
const OFFICE_POS = new Set(["10", "11", "12", "20", "49", "81"]);

/** These codes do not name one item. They are not given a price. */
const UNSPECIFIED = new Set(["J3490", "A9270", "E1399"]);

export function unspecified(code: string) {
  return UNSPECIFIED.has(code.trim().toUpperCase());
}

export function placeOf(text: string): "nf" | "fac" | null {
  if (/non-?\s*facility|\boffice\b/i.test(text)) return "nf";
  if (/\bfacility\b/i.test(text)) return "fac";
  const pos = text.match(/\bpos\s*(\d{2})\b/i);
  if (!pos) return null;
  if (FACILITY_POS.has(pos[1])) return "fac";
  if (OFFICE_POS.has(pos[1])) return "nf";
  return null;
}

/** A named place wins. An institutional line with no place uses the facility amount. */
export function profilePlace(text: string, claim: "professional" | "institutional" | "other" | null): "nf" | "fac" | null {
  const named = placeOf(text);
  if (named) return named;
  return claim === "institutional" ? "fac" : null;
}

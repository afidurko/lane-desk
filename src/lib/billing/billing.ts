import { AMBULANCE_NAMES, type AmbulanceFile } from "@/lib/book/ambulance";
import { payableStatus, STATUS_LABEL } from "@/lib/book/filter";
import { type DmeFile, type LabFile } from "@/lib/book/other";
import { conversionFor, localityDollars, reducedDollars, type PfsFile } from "@/lib/book/price";
import { applyMppr } from "@/lib/pricing/mppr";
import { contain } from "@/lib/security/patch-net";

export type Client = {
  id: string;
  name: string;
  npi: string;
};

export type Line = {
  id: string;
  code: string;
  modifier: string;
  units: number;
  chargeCents: number | null;
  /** Per-unit file amount at the full rate. The therapy reduction is applied across the claim, see allowedByLine. */
  allowedCents: number | null;
  /** Set on a Medicare therapy line (CMS MULT PROC 5): practice-expense RVU for ranking, and the per-unit reduced amount. */
  mppr?: { pe: number; reducedCents: number };
  schedule: string;
  note: string;
  otherCents?: number | null;
  otherSchedule?: string;
  dispute?: string;
};

export type Claim = {
  id: string;
  clientId: string;
  number: string;
  dos: string;
  pos: string;
  diagnosis: string;
  note: string;
  payer: "medicare" | "medicaid";
  status: "draft" | "ready";
  lines: Line[];
};

export type Books = {
  physician: PfsFile | null;
  ambulance: AmbulanceFile | null;
  lab: LabFile | null;
  dme: DmeFile | null;
};

const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;
const ICD = /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;

export function validDiagnosis(value: string) {
  return ICD.test(value.trim().toUpperCase());
}

export function validNpi(value: string) {
  if (!/^\d{10}$/.test(value)) return false;
  const digits = `80840${value}`;
  let sum = 0;
  let double = true;
  for (let i = digits.length - 2; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

export function centsFromDollars(value: string) {
  const text = value.trim();
  if (text === "") return { ok: true as const, cents: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false as const, error: "Use dollars and cents, like 120.00." };
  return { ok: true as const, cents: Math.round(Number(text) * 100) };
}

export function checkClient(name: string, npi: string) {
  const contained = contain(name);
  if (contained.decision === "stop") return { ok: false as const, error: "That organization name was stopped. No identifier is stored." };
  const clean = contained.text.trim();
  if (clean.length < 2) return { ok: false as const, error: "Enter the organization name." };
  const id = npi.trim();
  if (id !== "" && !validNpi(id)) return { ok: false as const, error: "That NPI does not pass the check digit. Leave it blank if you do not have it." };
  return { ok: true as const, name: clean, npi: id };
}

export function checkClaim(dos: string, pos: string, diagnosis: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dos)) return { ok: false as const, error: "Enter a date of service." };
  if (pos !== "" && !/^(11|12|41|49|99)$/.test(pos)) return { ok: false as const, error: "Place of service is not one of the listed codes." };
  const dx = diagnosis.trim().toUpperCase();
  if (dx !== "" && !ICD.test(dx)) return { ok: false as const, error: "Diagnosis must be a code, like M25.561. Do not type a description." };
  return { ok: true as const, dos, pos, diagnosis: dx };
}

export function checkClaimNumber(value: string) {
  const text = value.trim().toUpperCase();
  if (text === "") return { ok: true as const, number: "" };
  if (!/^[A-Z0-9-]{1,20}$/.test(text)) {
    return { ok: false as const, error: "Claim number is letters, digits, and hyphens, up to 20." };
  }
  if (/^\d{3}-?\d{2}-?\d{4}$/.test(text)) {
    return { ok: false as const, error: "That looks like an identifier. Use a claim number, not a person." };
  }
  return { ok: true as const, number: text };
}

export function checkNote(value: string) {
  const contained = contain(value);
  if (contained.decision === "stop") return { ok: false as const, error: "That note was stopped. No identifier is stored." };
  return { ok: true as const, note: contained.text.trim() };
}

export const NOT_OFFICE_NOTE =
  "Not priced in the office setting. CMS has no office price for this code because it is rarely or never done in the office.";

export function quoteCode(
  books: Books,
  code: string,
  modifier: string,
): { schedule: string; allowedCents: number | null; note: string; mppr?: { pe: number; reducedCents: number } } {
  const clean = code.trim().toUpperCase();
  const mod = modifier.trim().toUpperCase();
  if (!CODE.test(clean)) return { schedule: "none", allowedCents: null, note: "The code is not a HCPCS or CPT shape." };
  if (mod !== "" && !/^[A-Z0-9]{2}$/.test(mod)) return { schedule: "none", allowedCents: null, note: "A modifier is two characters." };

  const trip = books.ambulance?.rows.find((row) => row.carrier === "13282" && row.loc === "99" && row.c === clean);
  if (trip && clean in AMBULANCE_NAMES) {
    return {
      schedule: "Ambulance, Rest of New York, rural",
      allowedCents: trip.rural,
      note: AMBULANCE_NAMES[clean],
    };
  }

  const physician = books.physician?.rows.find((row) => row.c === clean && row.m === mod);
  if (physician && payableStatus(physician.s) && physician.nn) {
    return { schedule: "Physician file, not priced", allowedCents: null, note: NOT_OFFICE_NOTE };
  }

  if (physician && payableStatus(physician.s)) {
    const place = books.physician?.localities.find((item) => item.mac === "13282" && item.number === "99") ?? null;
    const conversion = books.physician ? conversionFor(physician, "nonQp", books.physician) : null;
    const dollars = conversion && books.physician ? localityDollars(physician, "nf", place, conversion) : 0;
    const reduced = conversion && books.physician && physician.mu ? reducedDollars(physician, place, conversion) : 0;
    return {
      schedule: "Physician, Rest of New York, non-facility, non-QP",
      allowedCents: dollars > 0 ? Math.round(dollars * 100) : null,
      note: physician.d,
      ...(dollars > 0 && reduced > 0 ? { mppr: { pe: physician.pn, reducedCents: Math.round(reduced * 100) } } : {}),
    };
  }

  const lab = books.lab?.rows.find((row) => row.c === clean && row.m === mod);
  if (lab) {
    return { schedule: "Clinical lab", allowedCents: lab.rate, note: lab.name };
  }

  const dme = books.dme?.rows.find((row) => row.c === clean && row.m === mod);
  if (dme) {
    return { schedule: "DMEPOS, New York rural", allowedCents: dme.rural, note: dme.name || "No description in the file." };
  }

  if (physician) {
    return { schedule: "Physician file, not priced", allowedCents: null, note: STATUS_LABEL[physician.s] ?? `Status ${physician.s}.` };
  }

  return { schedule: "Not loaded", allowedCents: null, note: "This code is not on a loaded file for that year." };
}

/**
 * Medicare lines with their therapy reduction values read fresh from the loaded file, so a line saved before the
 * reduction existed is still priced right. Other payers are left alone: the reduction is a Medicare rule.
 */
export function withReduction(lines: readonly Line[], books: Books, payer: "medicare" | "medicaid" = "medicare"): Line[] {
  if (payer !== "medicare") return lines.map((line) => (line.mppr ? { ...line, mppr: undefined } : line));
  return lines.map((line) => {
    const quoted = quoteCode(books, line.code, line.modifier);
    if (!quoted.mppr) return line.mppr ? { ...line, mppr: undefined } : line;
    return { ...line, mppr: quoted.mppr, allowedCents: line.allowedCents ?? quoted.allowedCents };
  });
}

/**
 * What each line is allowed, in cents for all its units, after the therapy multiple-procedure reduction.
 * A claim is one date of service, so every therapy line on it is one patient's day. Non-therapy lines are units x file amount.
 */
export function allowedByLine(lines: readonly Line[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const therapy = lines.filter((line) => line.mppr && line.allowedCents !== null && line.units >= 1);
  const results = applyMppr(
    therapy.map((line) => ({
      pe: line.mppr?.pe ?? 0,
      units: line.units,
      fullCents: line.allowedCents ?? 0,
      reducedCents: line.mppr?.reducedCents ?? 0,
    })),
  );
  for (const line of lines) out[line.id] = line.allowedCents === null ? null : line.allowedCents * line.units;
  therapy.forEach((line, index) => {
    out[line.id] = results[index].cents;
  });
  return out;
}

/** True when a line is paid with the practice-expense cut on at least one unit. */
export function reducedUnitsOf(lines: readonly Line[]): Record<string, number> {
  const therapy = lines.filter((line) => line.mppr && line.allowedCents !== null && line.units >= 1);
  const results = applyMppr(
    therapy.map((line) => ({
      pe: line.mppr?.pe ?? 0,
      units: line.units,
      fullCents: line.allowedCents ?? 0,
      reducedCents: line.mppr?.reducedCents ?? 0,
    })),
  );
  const out: Record<string, number> = {};
  therapy.forEach((line, index) => {
    out[line.id] = results[index].reducedUnits;
  });
  return out;
}

export function lineTotal(line: Line, allowedTotal: number | null = line.allowedCents === null ? null : line.allowedCents * line.units) {
  return {
    charge: line.chargeCents === null ? null : line.chargeCents * line.units,
    allowed: allowedTotal,
  };
}

export function claimTotals(lines: Line[]) {
  let charge = 0;
  let allowed = 0;
  let chargeKnown = false;
  let allowedKnown = false;
  const byLine = allowedByLine(lines);
  for (const line of lines) {
    const total = lineTotal(line, byLine[line.id]);
    if (total.charge !== null) {
      charge += total.charge;
      chargeKnown = true;
    }
    if (total.allowed !== null) {
      allowed += total.allowed;
      allowedKnown = true;
    }
  }
  return {
    chargeCents: chargeKnown ? charge : null,
    allowedCents: allowedKnown ? allowed : null,
  };
}

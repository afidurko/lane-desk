import { AMBULANCE_NAMES } from "@/lib/book/ambulance";
import type { Books, Claim, Line } from "@/lib/billing/billing";
import { validDiagnosis } from "@/lib/billing/billing";
import { THERAPY } from "@/lib/desk/therapy-codes";

export type Guard = {
  lineId: string | null;
  code: string;
  reason: string;
  expectedCents: number | null;
};

const THERAPY_CODES = new Set(THERAPY.map((item) => item.code));
const AMBULANCE = new Set(Object.keys(AMBULANCE_NAMES));
const DISCIPLINE = new Set(["GP", "GO", "GN"]);
/** 15-minute therapy. The 8-unit cap is this set only. Mileage and untimed codes are not capped at 8. */
const TIMED = new Set([
  "92608",
  "97032",
  "97033",
  "97034",
  "97035",
  "97036",
  "97110",
  "97112",
  "97113",
  "97116",
  "97124",
  "97129",
  "97130",
  "97140",
  "97530",
  "97533",
  "97535",
  "97537",
  "97542",
  "97550",
  "97551",
  "97750",
  "97755",
  "97760",
  "97761",
  "97763",
]);

export function oneYearLater(dos: string) {
  const [year, month, day] = dos.split("-").map(Number);
  const safeDay = month === 2 && day === 29 ? 28 : day;
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/** Reasons a claim must not be marked ready. This does not decide coverage. */
export function claimGuards(claim: Claim, books: Books | null, today = ""): Guard[] {
  const guards: Guard[] = [];
  const medicare = (claim.payer ?? "medicare") === "medicare";

  if (!validDiagnosis(claim.diagnosis)) {
    guards.push({
      lineId: null,
      code: "21",
      reason: "Box 21 needs a diagnosis code, such as M25.561. A word is not a code.",
      expectedCents: null,
    });
  }

  if (medicare && books?.physician && /^\d{4}-\d{2}-\d{2}$/.test(claim.dos) && books.physician.year !== Number(claim.dos.slice(0, 4))) {
    guards.push({
      lineId: null,
      code: claim.dos.slice(0, 4),
      reason: `Date of service is ${claim.dos.slice(0, 4)}. The loaded physician file is ${books.physician.year}. Ready stays blocked so the wrong year is not billed.`,
      expectedCents: null,
    });
  }

  if (today && /^\d{4}-\d{2}-\d{2}$/.test(claim.dos) && oneYearLater(claim.dos) < today) {
    guards.push({
      lineId: null,
      code: claim.dos,
      reason: "The date of service is more than a year before today. Medicare timely filing is 12 months. Ready stays blocked.",
      expectedCents: null,
    });
  }

  const seen = new Set<string>();
  const disciplines = new Set<string>();
  for (const line of claim.lines) {
    const code = line.code.trim().toUpperCase();
    const modifier = line.modifier.trim().toUpperCase();
    const key = `${code}|${modifier}`;
    if (seen.has(key)) {
      guards.push({
        lineId: line.id,
        code,
        reason: "This code and modifier are already on the claim. Duplicate lines are not marked ready.",
        expectedCents: null,
      });
    }
    seen.add(key);

    if (!Number.isInteger(line.units) || line.units < 1 || line.units > 999) {
      guards.push({
        lineId: line.id,
        code,
        reason: "Units must be a whole number from 1 to 999.",
        expectedCents: null,
      });
    } else if (medicare && TIMED.has(code) && line.units > 8) {
      guards.push({
        lineId: line.id,
        code,
        reason: "Timed therapy is 1 to 8 units. Under 8 minutes is not a unit. Mileage and untimed codes are not capped at 8.",
        expectedCents: null,
      });
    }

    if (medicare && THERAPY_CODES.has(code)) {
      if (!DISCIPLINE.has(modifier)) {
        guards.push({
          lineId: line.id,
          code,
          reason: "Outpatient therapy needs GP, GO, or GN. This desk does not guess the discipline.",
          expectedCents: null,
        });
      } else {
        disciplines.add(modifier);
      }
    }

    if (medicare && AMBULANCE.has(code) && claim.pos !== "41") {
      guards.push({
        lineId: line.id,
        code,
        reason: "An ambulance code needs place of service 41. Another place is not marked ready.",
        expectedCents: null,
      });
    }
  }

  if (disciplines.size > 1) {
    guards.push({
      lineId: null,
      code: [...disciplines].join(" "),
      reason: "GP, GO, and GN are different disciplines. Put each discipline on its own claim.",
      expectedCents: null,
    });
  }

  return guards;
}

export function lineForGuard(claim: Claim, guard: Guard, index: number): Line {
  return (
    claim.lines.find((line) => line.id === guard.lineId) ?? {
      id: guard.lineId ?? `guard-${index}`,
      code: guard.code,
      modifier: "",
      units: 1,
      chargeCents: null,
      allowedCents: null,
      schedule: "Claim",
      note: "",
    }
  );
}

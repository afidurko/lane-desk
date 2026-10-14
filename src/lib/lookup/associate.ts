import type { OnceRow } from "@/lib/lookup/once";

export type AssocHit = {
  family: string;
  label: string;
  row: { a: Record<string, number | null | undefined> };
};

export type Association = {
  cents: number | null;
  label: string | null;
  block: string | null;
};

const AMBULANCE = /^A0(425|426|427|428|429|433|434|435|436|437|438|439)$/;

/** One file, or no match. A weak link is not given a dollar. */
export function associate(input: {
  code: string;
  modifier: string;
  year: number | null;
  setting: "nf" | "fac" | null;
  payer: "medicare" | "medicaid" | null;
  ambiguous: boolean;
  chargeKnown: boolean;
  paymentAudit?: boolean;
  hits: AssocHit[];
  once: OnceRow | null;
}): Association {
  if (input.ambiguous) return blocked("Two amounts are on the line. The charge was not chosen.");
  if (!input.chargeKnown && !input.paymentAudit) return blocked("There is no charge column. A paid or allowed amount was not used.");
  const modifier = input.modifier.toUpperCase();
  if (modifier === "26" || modifier === "TC") {
    return blocked(`Modifier ${modifier} is not priced on the loaded file. The full amount was not used.`);
  }
  if (input.payer === "medicaid") return blocked("A Medicare file amount is not used for Medicaid.");

  const priced = input.hits.flatMap((hit) => {
    const cents = input.year ? hit.row.a[String(input.year)] : undefined;
    return typeof cents === "number" ? [{ ...hit, cents }] : [];
  });
  const ambulance = AMBULANCE.test(input.code.toUpperCase());
  const usable = ambulance ? priced.filter((hit) => hit.family === "ambulance") : priced;
  if (ambulance && usable.length === 0 && priced.length > 0) {
    return blocked("An ambulance code is not priced from the physician file.");
  }
  if (usable.length > 1) return blocked("This code is on more than one file. It was not assigned.");
  if (usable.length === 1) {
    const chosen = usable[0];
    if (chosen.family === "physician" && input.setting === "fac") {
      return blocked("The facility amount is not this file. The office amount was not used.");
    }
    return { cents: chosen.cents, label: chosen.label, block: null };
  }
  if (input.once) return { cents: input.once.c, label: input.once.s, block: null };
  return { cents: null, label: null, block: null };
}

function blocked(block: string): Association {
  return { cents: null, label: null, block };
}

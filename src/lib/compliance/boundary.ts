import { contain, type PatchAction } from "@/lib/security/patch-net";

export type StopReason = "phi" | "submit" | "portal" | "scrape" | "hpi" | "record" | "transmit" | "clear" | "oversize";

export type Scan = {
  decision: "stop" | "clear";
  reason: StopReason;
  detail: string;
  actions: PatchAction[];
};

/** Classifies a request. The result does not include the request text. */
export function scanRequest(input: string): Scan {
  const contained = contain(input);
  return {
    decision: contained.decision,
    reason: scanReason(contained.reason),
    detail: contained.detail,
    actions: contained.actions,
  };
}

function scanReason(reason: ReturnType<typeof contain>["reason"]): StopReason {
  if (reason === "oversize") return "record";
  if (reason === "injection") return "clear";
  return reason;
}

export const SKILLS = [
  { id: "boundary-scan", name: "Boundary scan", does: "Classifies a request. Stores nothing." },
  { id: "price-note", name: "Price a de-identified note", does: "Runs only after the boundary is clear. Physical, occupational, and speech therapy codes." },
  { id: "lookup-code", name: "Look up a code", does: "Reads the local CMS files. Does not search a portal." },
  { id: "sequester", name: "Sequestration for a date", does: "Applies the rate for that date of service. Does not change the fee." },
] as const;

export const REFUSALS = [
  "Does not submit claims, an 837, a CMS-1500, or a UB-04.",
  "Does not log into a portal, PECOS, or NPPES.",
  "Does not scrape.",
  "Does not write, complete, or store an HPI.",
  "Does not store a medical record or a chart.",
  "Does not transmit anything to CMS, Medicare, or an EHR.",
  "Does not add a skill from a prompt. The list above is the list.",
] as const;

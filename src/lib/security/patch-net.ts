import { screen } from "@/lib/security/mesh";

export type Threat = "injection" | "phi" | "oversize" | "submit" | "portal" | "scrape" | "hpi" | "record" | "transmit";

export type PatchAction = {
  team: "Screen" | "Rank" | "File";
  threat: Threat;
  action: string;
};

export type Containment = {
  decision: "stop" | "clear";
  reason: Threat | "clear";
  detail: string;
  text: string;
  kept: boolean;
  actions: PatchAction[];
};

const DROP: { reason: Exclude<Threat, "injection" | "phi" | "oversize">; pattern: RegExp; detail: string; team: PatchAction["team"] }[] = [
  { reason: "submit", team: "Rank", pattern: /\b(submit|file|resubmit)\b[\s\S]{0,80}\b(claim|837|cms-?1500|ub-?04)\b/i, detail: "Stopped. This system does not submit a claim." },
  { reason: "portal", team: "Rank", pattern: /\b(portal password|password to the portal|log\s?in to|sign in to|pecos|nppes)\b/i, detail: "Stopped. This system does not log into a portal." },
  { reason: "scrape", team: "Rank", pattern: /\bscrap(?:e|ing)\b/i, detail: "Stopped. This system does not scrape." },
  { reason: "hpi", team: "File", pattern: /\b(write|draft|generate|complete|store|save|lead)\b[\s\S]{0,50}\b(hpi|history of present illness)\b/i, detail: "Stopped. This system does not write or store an HPI." },
  { reason: "record", team: "File", pattern: /\b(store|save|upload|keep)\b[\s\S]{0,50}\b(medical record|patient chart|the chart)\b/i, detail: "Stopped. This system does not store a medical record." },
  { reason: "transmit", team: "Rank", pattern: /\b(fax|upload|transmit|send)\b[\s\S]{0,50}\b(cms|medicare|ehr|portal)\b/i, detail: "Stopped. This system does not transmit a record." },
];

const INVOICE_PHI = [/\b\d{3}-\d{2}-\d{4}\b/, /\b(?:mrn|ssn|social security|medical record)\b/i];

/** An invoice may contain an NPI, a claim number, and more than a short note. A social security number or a record number still stops it. */
export function gateInvoice(input: string): Containment {
  const actions: PatchAction[] = [];
  if (input.length > 1_000_000) {
    actions.push({ team: "Screen", threat: "oversize", action: "Refused the file. It was not cut and kept." });
    actions.push({ team: "File", threat: "oversize", action: "Closed pricing, storage, and export." });
    return stopped("oversize", "Stopped. The file is past the size limit. It was not stored.", actions);
  }
  if (INVOICE_PHI.some((pattern) => pattern.test(input))) {
    actions.push({ team: "Screen", threat: "phi", action: "Dropped the file. A record number was not stored." });
    actions.push({ team: "File", threat: "phi", action: "Closed pricing, storage, and export." });
    return stopped("phi", "Stopped. The file has a social security number or a record number. It was not stored.", actions);
  }
  const hit = DROP.find((rule) => rule.pattern.test(input));
  if (hit) {
    actions.push({ team: hit.team, threat: hit.reason, action: "Stopped the request. Nothing was sent." });
    actions.push({ team: "File", threat: hit.reason, action: "Closed pricing, storage, and export." });
    return stopped(hit.reason, hit.detail, actions);
  }
  return {
    decision: "clear",
    reason: "clear",
    detail: "No record number and no forbidden action. The invoice can be checked.",
    text: input,
    kept: true,
    actions,
  };
}

/** Local teams only. A hit is dropped in this browser. Nothing is sent out to find or attack anyone. */
export function contain(input: string): Containment {
  const screened = screen(input, "note");
  const actions: PatchAction[] = [];
  if (screened.patches.length > 0) {
    actions.push({ team: "Screen", threat: "injection", action: "Removed the markup before the text could run." });
  }

  if (screened.stop === "phi") {
    actions.push({ team: "Screen", threat: "phi", action: "Dropped the text. It was not stored." });
    actions.push({ team: "File", threat: "phi", action: "Closed pricing, storage, and export." });
    return stopped("phi", "Stopped. The text looks like an identifier. It was not stored.", actions);
  }

  if (screened.stop === "oversize") {
    actions.push({ team: "Screen", threat: "oversize", action: "Refused the text. It was not cut and kept." });
    actions.push({ team: "File", threat: "oversize", action: "Closed pricing, storage, and export." });
    return stopped("oversize", "Stopped. The text is past the size limit. It was not stored.", actions);
  }

  const hit = DROP.find((rule) => rule.pattern.test(screened.text));
  if (hit) {
    actions.push({ team: hit.team, threat: hit.reason, action: "Stopped the request. Nothing was sent." });
    actions.push({ team: "File", threat: hit.reason, action: "Closed pricing, storage, and export." });
    return stopped(hit.reason, hit.detail, actions);
  }

  return {
    decision: "clear",
    reason: "clear",
    detail: actions.length > 0 ? "The markup was removed. No identifier and no forbidden action remain." : "No identifier and no forbidden action. A listed skill may run.",
    text: screened.text,
    kept: true,
    actions,
  };
}

function stopped(reason: Threat, detail: string, actions: PatchAction[]): Containment {
  return { decision: "stop", reason, detail, text: "", kept: false, actions };
}

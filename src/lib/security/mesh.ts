export type Stop = "phi" | "oversize" | "bad-email" | null;

export type Screen = {
  text: string;
  patches: string[];
  stop: Stop;
};

const NOTE_MAX = 8_000;
const FIELD_MAX = 200;

const PHI = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:mrn|dob|ssn|social security|medical record)\b/i,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{8,}\b/,
];

const RULES: { pattern: RegExp; detail: string }[] = [
  // Matching control characters is the point of this rule.
  // eslint-disable-next-line no-control-regex
  { pattern: /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, detail: "Removed hidden control characters." },
  { pattern: /<\s*\/?\s*script\b[^>]*>/gi, detail: "Removed a script tag." },
  { pattern: /<\/?[a-z][^>\n]*>/gi, detail: "Removed markup." },
  { pattern: /\bjava\s*script\s*:/gi, detail: "Removed a javascript URL." },
  { pattern: /\bvb\s*script\s*:/gi, detail: "Removed a vbscript URL." },
  { pattern: /\bdata\s*:\s*text\/html/gi, detail: "Removed a data URL." },
  { pattern: /\bon[a-z]{2,}\s*=/gi, detail: "Removed an event handler." },
];

function apply(pattern: RegExp, text: string) {
  pattern.lastIndex = 0;
  const found = pattern.test(text);
  pattern.lastIndex = 0;
  if (!found) return text;
  const next = text.replace(pattern, "");
  pattern.lastIndex = 0;
  return next;
}

function scrub(text: string) {
  const patches: string[] = [];
  let current = text;
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const rule of RULES) {
      const next = apply(rule.pattern, current);
      if (next !== current) {
        if (!patches.includes(rule.detail)) patches.push(rule.detail);
        current = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { text: current, patches };
}

export function screen(input: string, kind: "note" | "field" | "email"): Screen {
  const limit = kind === "note" ? NOTE_MAX : FIELD_MAX;
  if (input.length > limit) {
    return {
      text: input.slice(0, limit),
      patches: ["Cut the text to the size limit."],
      stop: "oversize",
    };
  }

  const cleaned = scrub(input);

  if (kind === "email") {
    const email = cleaned.text.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { text: email, patches: cleaned.patches, stop: "bad-email" };
    }
    return { text: email, patches: cleaned.patches, stop: null };
  }

  if (PHI.some((pattern) => pattern.test(cleaned.text))) {
    return { text: cleaned.text, patches: cleaned.patches, stop: "phi" };
  }

  return { text: cleaned.text, patches: cleaned.patches, stop: null };
}

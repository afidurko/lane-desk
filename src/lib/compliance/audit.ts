export type AuditEntry = {
  at: string;
  skill: string;
  decision: "stop" | "clear";
  reason: string;
};

const KEY = "lane-audit";
const MAX = 50;

export function recordAudit(entry: Omit<AuditEntry, "at">) {
  if (typeof window === "undefined") return;
  const next = [{ ...entry, at: new Date().toISOString() }, ...readAudit()].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function readAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is AuditEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.at === "string" && typeof row.skill === "string" && typeof row.decision === "string" && typeof row.reason === "string";
}

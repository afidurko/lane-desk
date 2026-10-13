import type { PayBucket } from "@/lib/lookup/check";

const KEY = "lane-payment-alerts";

export type StoredAlert = {
  id: string;
  at: string;
  code: string;
  year: number | null;
  billedCents: number | null;
  fileCents: number | null;
  kind: PayBucket;
  reason: string;
};

export function readPaymentMemory(): StoredAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAlert).slice(0, 40);
  } catch {
    return [];
  }
}

export function rememberPayments(rows: StoredAlert[]) {
  if (typeof window === "undefined") return;
  const kept = rows.filter((row) => row.kind !== "match").slice(0, 40);
  window.localStorage.setItem(KEY, JSON.stringify(kept));
}

function isAlert(value: unknown): value is StoredAlert {
  if (!value || typeof value !== "object") return false;
  const row = value as StoredAlert;
  return typeof row.code === "string" && (row.kind === "off" || row.kind === "look" || row.kind === "match") && typeof row.reason === "string";
}

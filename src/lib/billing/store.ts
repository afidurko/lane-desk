import type { Claim, Client } from "@/lib/billing/billing";

const KEY = "lane-billing";

export type BillingBook = { clients: Client[]; claims: Claim[] };

export function readBilling(): BillingBook {
  if (typeof window === "undefined") return { clients: [], claims: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return { clients: [], claims: [] };
    const book = parsed as BillingBook;
    return {
      clients: Array.isArray(book.clients) ? book.clients.filter(isClient) : [],
      claims: Array.isArray(book.claims)
        ? book.claims.filter(isClaim).map((claim) => ({ ...claim, number: claim.number ?? "", note: claim.note ?? "" }))
        : [],
    };
  } catch {
    return { clients: [], claims: [] };
  }
}

export function writeBilling(book: BillingBook) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(book));
}

function isClient(value: unknown): value is Client {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.npi === "string";
}

function isClaim(value: unknown): value is Claim {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.clientId === "string" && typeof row.dos === "string" && Array.isArray(row.lines) && (row.status === "draft" || row.status === "ready");
}

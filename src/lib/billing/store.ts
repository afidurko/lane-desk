import type { Claim, Client, Line } from "@/lib/billing/billing";

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

/** Puts a priced line on the open draft for that year. Creates the draft if none exists. Does not transmit. */
export function addToOpenClaim(input: {
  code: string;
  modifier: string;
  units: number;
  chargeCents: number | null;
  allowedCents: number | null;
  mppr?: { pe: number; reducedCents: number };
  schedule: string;
  note: string;
  year: number;
  claimNote?: string;
  dos?: string;
}): { createdClaim: boolean } {
  const book = readBilling();
  if (book.clients.length === 0) {
    book.clients.push({ id: crypto.randomUUID(), name: "Not named yet", npi: "" });
  }
  const yearText = String(input.year);
  let claim = book.claims.find((item) => item.status === "draft" && item.dos.startsWith(yearText)) ?? null;
  const createdClaim = claim === null;
  if (!claim) {
    const ambulance = /^A0(425|426|427|428|429|433|434|435|436|437|438|439)$/.test(input.code);
    claim = {
      id: crypto.randomUUID(),
      clientId: book.clients[0].id,
      dos: input.dos && /^\d{4}-\d{2}-\d{2}$/.test(input.dos) ? input.dos : `${yearText}-07-01`,
      pos: ambulance ? "41" : "11",
      diagnosis: "",
      number: "",
      note: "",
      payer: "medicare",
      status: "draft",
      lines: [],
    };
    book.claims = [claim, ...book.claims];
  }
  if (input.claimNote && !claim.note) claim.note = input.claimNote;
  const line: Line = {
    id: crypto.randomUUID(),
    code: input.code.trim().toUpperCase(),
    modifier: input.modifier.trim().toUpperCase(),
    units: input.units,
    chargeCents: input.chargeCents,
    allowedCents: input.allowedCents,
    ...(input.mppr ? { mppr: input.mppr } : {}),
    schedule: input.schedule,
    note: input.note,
  };
  claim.lines = [...claim.lines, line];
  writeBilling(book);
  return { createdClaim };
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

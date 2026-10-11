import { contain } from "@/lib/security/patch-net";
import { CHAIN, SEATS } from "@/lib/team/roster";

export type Packet = {
  id: string;
  at: string;
  note: string;
  codes: { code: string; units: number; allowed: number }[];
  status: "queued" | "cleared" | "stopped";
  reason: string;
  chain: readonly string[];
};

const KEY = "lane-team-queue";
const MAX = 40;

/** A packet is created only after the boundary is clear. The note is the screened text. */
export function makePacket(note: string, codes: { code: string; units: number; allowed: number }[]): Packet {
  const screened = contain(note);
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  if (screened.decision === "stop") {
    return { id, at, note: "", codes: [], status: "stopped", reason: screened.detail, chain: CHAIN };
  }
  return {
    id,
    at,
    note: screened.text.trim(),
    codes,
    status: "queued",
    reason: "Cleared locally. Waiting for the team. Not sent.",
    chain: CHAIN,
  };
}

export function readQueue(): Packet[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPacket).slice(0, MAX);
  } catch {
    return [];
  }
}

export function writeQueue(packets: Packet[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(packets.slice(0, MAX)));
}

export function seatName(id: string) {
  return SEATS.find((seat) => seat.id === id)?.name ?? id;
}

function isPacket(value: unknown): value is Packet {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.at === "string" && typeof row.status === "string";
}

import { contain } from "@/lib/security/patch-net";
import { CHAIN, SEATS } from "@/lib/team/roster";
import { RANK_MEMORY } from "@/lib/team/rank-memory";

export type RankBrief = {
  seat: "Rank";
  status: "pass" | "stop";
  detail: string;
  order: string[];
  chain: string[];
};

const RANK = [
  { test: /not enrolled|gate/i, weight: 0 },
  { test: /medicare|medicaid|rate/i, weight: 1 },
  { test: /meeting|seat/i, weight: 2 },
];

/** Rank orders the open work. It does not submit, and it does not invent a rate. */
export function rankBrief(problems: string[], text = ""): RankBrief {
  const chain = CHAIN.map((id) => SEATS.find((seat) => seat.id === id)?.name ?? id);
  const screened = contain(text);
  if (text.trim() && screened.decision === "stop") {
    return { seat: "Rank", status: "stop", detail: screened.detail, order: [], chain };
  }
  const order = [...problems].sort((a, b) => weight(a) - weight(b));
  return {
    seat: "Rank",
    status: "pass",
    detail: order.length === 0 ? "Nothing is open. A vendor bill still goes to the invoice." : "Do these in this order. Nothing is sent.",
    order,
    chain,
  };
}

const ROLL = ["look", "off", "match"] as const;

export type InvoiceRollout = {
  seat: "Rank";
  status: "pass" | "stop";
  detail: string;
  order: Array<(typeof ROLL)[number]>;
};

/** Rank orders an imported invoice. A wrong or unpriced line comes before a match. Nothing is sent. */
export function rankInvoice(counts: { look: number; off: number; match: number }, text = ""): InvoiceRollout {
  const screened = contain(text);
  if (text.trim() && screened.decision === "stop") {
    return { seat: "Rank", status: "stop", detail: screened.detail, order: [] };
  }
  const order = ROLL.filter((key) => counts[key] > 0);
  const detail =
    counts.look > 0
      ? "A person has to look before anything is paid."
      : counts.off > 0
        ? "Do not pay a charge that does not match. Use the file amount."
        : counts.match > 0
          ? "Every charge matches the file."
          : "No coded line was on the invoice.";
  return { seat: "Rank", status: "pass", detail, order };
}

function weight(line: string) {
  return RANK.find((row) => row.test.test(line))?.weight ?? 3;
}

/** The seat's saved progress. It does not add a price. */
export function rankMemory() {
  return RANK_MEMORY;
}

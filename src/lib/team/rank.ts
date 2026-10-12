import { contain } from "@/lib/security/patch-net";
import { CHAIN, SEATS } from "@/lib/team/roster";

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

function weight(line: string) {
  return RANK.find((row) => row.test.test(line))?.weight ?? 3;
}

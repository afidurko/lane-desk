import { contain } from "@/lib/security/patch-net";
import { CHAIN, SEATS } from "@/lib/team/roster";

export type BridgeFile = {
  name: string;
  status: "current" | "due" | "gap";
  detail: string;
};

export type BridgeRow = {
  name: string;
  status: BridgeFile["status"];
  action: string;
};

export type BridgeResult = {
  status: "pass" | "stop";
  detail: string;
  chain: string[];
  order: BridgeRow[];
};

const WEIGHT = { gap: 0, due: 1, current: 2 } as const;

/** Daily read of the loaded files. It does not call a bot, download a schedule, or fill a gap. */
export function dailyBridge(files: BridgeFile[], text = ""): BridgeResult {
  const chain = CHAIN.map((id) => SEATS.find((seat) => seat.id === id)?.name ?? id);
  const screened = contain(text);
  if (text.trim() && screened.decision === "stop") {
    return { status: "stop", detail: screened.detail, chain, order: [] };
  }
  const order = [...files]
    .sort((a, b) => WEIGHT[a.status] - WEIGHT[b.status] || a.name.localeCompare(b.name))
    .map((file) => ({
      name: file.name,
      status: file.status,
      action:
        file.status === "current"
          ? "Kept. The loaded file is still the one to use."
          : file.status === "due"
            ? "Left for the next file. This check does not download it."
            : "Left open. A missing amount is not filled in.",
    }));
  const gaps = order.filter((row) => row.status === "gap").length;
  return {
    status: "pass",
    detail: gaps === 0 ? "Nothing is open. No amount was changed." : `${gaps} ${gaps === 1 ? "gap stays" : "gaps stay"} open. No amount was guessed.`,
    chain,
    order,
  };
}

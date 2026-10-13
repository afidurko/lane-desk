import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/history")({
  beforeLoad: publicNotFound,
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/lookup/history-page").then((m) => ({ default: m.HistoryPage })))
    : closedScreen("Codes that changed"),
  head: () => ({
    meta: [
      { title: "Lane — Codes that changed" },
      { name: "description", content: "Internal: amounts from the first loaded year to the last." },
    ],
  }),
});

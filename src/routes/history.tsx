import { createFileRoute } from "@tanstack/react-router";
import { HistoryPage } from "@/components/lookup/history-page";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Lane — Codes that changed" },
      { name: "description", content: "Rest of New York amounts from the first loaded year to the last, for physician, ambulance, lab, and equipment codes." },
    ],
  }),
});

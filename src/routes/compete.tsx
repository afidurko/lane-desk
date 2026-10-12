import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { CompetePage } from "@/components/compete/compete-page";

export const Route = createFileRoute("/compete")({
  component: internalOnly(CompetePage, "Leave-behind"),
  head: () => ({
    meta: [
      { title: "Lane — Leave-behind" },
      {
        name: "description",
        content: "What this desk automates beside a PACE operating platform. Rest of New York, MAC 13282, sequestration by date.",
      },
    ],
  }),
});

import { createFileRoute } from "@tanstack/react-router";
import { CompetePage } from "@/components/compete/compete-page";

export const Route = createFileRoute("/compete")({
  component: CompetePage,
  head: () => ({
    meta: [
      { title: "Lane — Leave-behind" },
      { name: "description", content: "What this desk automates beside a PACE operating platform. Rest of New York, MAC 13282, sequestration by date." },
    ],
  }),
});

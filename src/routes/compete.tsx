import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/compete")({
  beforeLoad: publicNotFound,
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/compete/compete-page").then((m) => ({ default: m.CompetePage })))
    : closedScreen("Leave-behind"),
  head: () => ({
    meta: [
      { title: "Lane — Leave-behind" },
      {
        name: "description",
        content: IS_INTERNAL ? "What this desk automates beside a PACE operating platform. Rest of New York, MAC 13282, sequestration by date." : "Internal screen.",
      },
    ],
  }),
});

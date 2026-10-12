import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/why")({
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/landing/why-page").then((m) => ({ default: m.WhyPage })))
    : closedScreen("Why"),
  head: () => ({
    meta: [
      { title: "Lane — Why" },
      {
        name: "description",
        content: "Why Lane leaves the chart in place and prices therapy codes on the Rest of New York fee schedule.",
      },
    ],
  }),
});

import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/pace")({
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/pace/pace-page").then((m) => ({ default: m.PacePage })))
    : closedScreen("PACE month"),
  head: () => ({
    meta: [
      { title: "Lane — The month" },
      { name: "description", content: "PACE month worksheet for enrollment gates, the loaded Medicare county rate, the team meeting, the day, and rides. Nothing is submitted." },
    ],
  }),
});

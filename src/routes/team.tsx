import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/team")({
  beforeLoad: publicNotFound,
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/team/team-page").then((m) => ({ default: m.TeamPage })))
    : closedScreen("Team"),
  head: () => ({
    meta: [
      { title: "Lane — Team" },
      { name: "description", content: "The desk chain, the scoreboard, the gold set, and the file update registry." },
    ],
  }),
});

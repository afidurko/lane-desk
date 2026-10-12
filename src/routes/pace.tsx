import { createFileRoute } from "@tanstack/react-router";
import { PacePage } from "@/components/pace/pace-page";

export const Route = createFileRoute("/pace")({
  component: PacePage,
  head: () => ({
    meta: [
      { title: "Lane — The month" },
      { name: "description", content: "PACE month worksheet for enrollment gates, the loaded Medicare county rate, the team meeting, the day, and rides. Nothing is submitted." },
    ],
  }),
});

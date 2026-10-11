import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/components/team/team-page";

export const Route = createFileRoute("/team")({
  component: TeamPage,
  head: () => ({
    meta: [
      { title: "Lane — Team" },
      { name: "description", content: "The desk chain, the scoreboard, the gold set, and the file update registry." },
    ],
  }),
});

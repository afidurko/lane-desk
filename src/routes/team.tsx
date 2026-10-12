import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { TeamPage } from "@/components/team/team-page";

export const Route = createFileRoute("/team")({
  component: internalOnly(TeamPage, "Team"),
  head: () => ({
    meta: [
      { title: "Lane — Team" },
      { name: "description", content: "The desk chain, the scoreboard, the gold set, and the file update registry." },
    ],
  }),
});

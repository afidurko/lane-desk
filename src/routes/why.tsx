import { createFileRoute } from "@tanstack/react-router";
import { internalOnly } from "@/components/gate";
import { WhyPage } from "@/components/landing/why-page";

export const Route = createFileRoute("/why")({
  component: internalOnly(WhyPage, "Why"),
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

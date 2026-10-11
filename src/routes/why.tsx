import { createFileRoute } from "@tanstack/react-router";
import { WhyPage } from "@/components/landing/why-page";

export const Route = createFileRoute("/why")({
  component: WhyPage,
  head: () => ({
    meta: [
      { title: "Lane — Why" },
      {
        name: "description",
        content:
          "Why Lane leaves the chart in place and times six adult-day therapy codes on one national fee schedule.",
      },
    ],
  }),
});

import { createFileRoute } from "@tanstack/react-router";
import { TrendsPage } from "@/components/trends/trends-page";

export const Route = createFileRoute("/trends")({
  component: TrendsPage,
  head: () => ({
    meta: [
      { title: "Lane — Trends" },
      { name: "description", content: "The sheet as a chart. By year and by file. No amount is added." },
    ],
  }),
});

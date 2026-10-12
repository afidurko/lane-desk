import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/pages/about-page";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "Lane — What this is" },
      {
        name: "description",
        content: "What Lane is, what it is not, New York only coverage, data sources and years. Medicare reference price, not a payment.",
      },
    ],
  }),
});

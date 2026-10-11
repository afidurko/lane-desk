import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/landing/pricing-page";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Lane — Pricing" },
      {
        name: "description",
        content:
          "List-shaped pricing for a coding and fee-schedule clock. Not a quote and not a savings claim. A real price follows a timed run.",
      },
    ],
  }),
});

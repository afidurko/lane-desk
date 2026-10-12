import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/landing/pricing-page";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Lane — Pricing" },
      {
        name: "description",
        content: "Plan list for a pilot, per-claim, and wrap. List shape only, not a quote and not a savings claim.",
      },
    ],
  }),
});

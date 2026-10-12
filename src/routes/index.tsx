import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/pages/home-page";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Lane — Medicare reference prices for New York" },
      {
        name: "description",
        content: "Check a de-identified therapy note or an invoice against the Medicare fee schedule. A reference price, not a payment.",
      },
    ],
  }),
});

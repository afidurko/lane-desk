import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/billing/billing-page";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Lane — Billing" },
      { name: "description", content: "A client billing worksheet priced from the loaded Medicare files. It does not transmit a claim." },
    ],
  }),
});

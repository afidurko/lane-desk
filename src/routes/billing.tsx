import { createFileRoute } from "@tanstack/react-router";
import { closedScreen, lazyScreen, publicNotFound } from "@/components/gate";
import { IS_INTERNAL } from "@/lib/config/mode";

export const Route = createFileRoute("/billing")({
  beforeLoad: publicNotFound,
  component: IS_INTERNAL
    ? lazyScreen(() => import("@/components/billing/billing-page").then((m) => ({ default: m.BillingPage })))
    : closedScreen("Claim worksheet"),
  head: () => ({
    meta: [
      { title: "Lane — Billing" },
      { name: "description", content: "A client billing worksheet priced from the loaded Medicare files. It does not transmit a claim." },
    ],
  }),
});

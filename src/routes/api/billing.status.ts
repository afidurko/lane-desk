import { createFileRoute } from "@tanstack/react-router";
import { PLANS } from "@/lib/billing/plans";
import { billingStatus, priceFor } from "@/lib/billing/stripe.server";

/** Tells the pricing screen which plans can show a card button. Says nothing about keys or price ids. */
export const Route = createFileRoute("/api/billing/status")({
  server: {
    handlers: {
      GET: async () => {
        const on = billingStatus(process.env).enabled;
        const plans = on ? PLANS.filter((plan) => priceFor(plan, process.env) !== null).map((plan) => plan.id) : [];
        return Response.json({ cardPayment: plans.length > 0, plans });
      },
    },
  },
});

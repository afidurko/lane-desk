import { createFileRoute } from "@tanstack/react-router";
import { billingStatus } from "@/lib/billing/stripe.server";

/** Tells the pricing screen whether to show the card option. Says nothing about keys. */
export const Route = createFileRoute("/api/billing/status")({
  server: {
    handlers: {
      GET: async () => Response.json({ cardPayment: billingStatus(process.env).enabled }),
    },
  },
});

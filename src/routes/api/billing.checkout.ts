import { createFileRoute } from "@tanstack/react-router";
import { createCheckout } from "@/lib/billing/stripe.server";

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let plan = "";
        try {
          const body = (await request.json()) as { plan?: unknown };
          plan = typeof body.plan === "string" ? body.plan : "";
        } catch {
          return Response.json({ error: "Send a plan." }, { status: 400 });
        }
        // Return URLs come from APP_URL only (see appBaseUrl), never from the request host.
        const result = await createCheckout(plan, process.env);
        return result.ok ? Response.json({ url: result.url }) : Response.json({ error: result.error }, { status: result.status });
      },
    },
  },
});

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
        const base = process.env.APP_URL?.trim() || new URL(request.url).origin;
        const result = await createCheckout(plan, base, process.env);
        return result.ok ? Response.json({ url: result.url }) : Response.json({ error: result.error }, { status: result.status });
      },
    },
  },
});

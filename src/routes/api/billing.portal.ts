import { createFileRoute } from "@tanstack/react-router";
import { createPortal } from "@/lib/billing/stripe.server";

export const Route = createFileRoute("/api/billing/portal")({
  server: {
    handlers: {
      POST: async () => {
        const result = await createPortal();
        return result.ok ? Response.json({ url: result.url }) : Response.json({ error: result.error }, { status: result.status });
      },
    },
  },
});

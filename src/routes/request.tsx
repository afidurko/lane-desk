import { createFileRoute } from "@tanstack/react-router";
import { RequestPage } from "@/components/pages/request-page";

export const Route = createFileRoute("/request")({
  component: RequestPage,
  head: () => ({
    meta: [
      { title: "Lane — Request a pilot or an invoice" },
      { name: "description", content: "Four details and a plan. Nothing is charged, stored, or sent from this page." },
    ],
  }),
});

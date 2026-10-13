import { createFileRoute } from "@tanstack/react-router";
import { InvoicePage } from "@/components/pages/invoice-page";

export const Route = createFileRoute("/invoice")({
  component: InvoicePage,
  head: () => ({
    meta: [
      { title: "Lane — Check an invoice" },
      {
        name: "description",
        content:
          "Paste invoice lines and see which ones match the Medicare reference price for their year. Medicare reference price, not a payment.",
      },
    ],
  }),
});

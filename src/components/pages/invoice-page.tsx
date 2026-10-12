import { InvoiceCheck } from "@/components/lookup/invoice-check";
import { Page } from "@/components/ui";

export function InvoicePage() {
  return (
    <Page
      kicker="Step 2 of 3"
      title="Check an invoice"
      lede="Paste the lines from a vendor invoice. Each line is compared with the Medicare reference price for its year, and you see which ones match."
    >
      <InvoiceCheck />
    </Page>
  );
}

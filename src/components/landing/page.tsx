import { InvoiceCheck } from "@/components/lookup/invoice-check";
import { YearLookup } from "@/components/lookup/year-lookup";
import { Shell } from "./shell";

export function LandingPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean · Rest of New York</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink">Code, year, price.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Type a code and see 2020 through 2026. Or paste the invoice and each line is checked against the year on that line.
        </p>
        <div className="mt-6">
          <YearLookup />
        </div>
        <h2 className="mt-12 font-display text-3xl text-ink">Check an invoice</h2>
        <div className="mt-4">
          <InvoiceCheck />
        </div>
      </main>
    </Shell>
  );
}

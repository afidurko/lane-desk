import { Link } from "@tanstack/react-router";
import { InvoiceCheck } from "@/components/lookup/invoice-check";
import { Shell } from "./shell";

export function LandingPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean · Rest of New York</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink">Check an invoice.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Each line is checked against the year on that line. For one code, open the Code tab.
        </p>
        <Link to="/code" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-teal">
          Look up one code
        </Link>
        <div className="mt-6">
          <InvoiceCheck />
        </div>
      </main>
    </Shell>
  );
}

import { Link } from "@tanstack/react-router";
import { YearLookup } from "@/components/lookup/year-lookup";
import { Shell } from "./shell";

export function LandingPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean · Rest of New York</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink">Look up a code.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Pick the schedule. Type the code. Each year has its own amount.
        </p>
        <div className="mt-6">
          <YearLookup />
        </div>
        <p className="mt-8 text-sm text-muted">
          A claim comes after the code.{" "}
          <Link to="/billing" className="font-medium text-teal">
            Open a claim
          </Link>{" "}
          only when you already have the year and the amount.
        </p>
      </main>
    </Shell>
  );
}

import { useState } from "react";
import { Shell } from "./shell";
import { Signup } from "./signup";
import type { PlanId } from "./types";

const PLANS: {
  id: PlanId;
  kicker: string;
  name: string;
  price: string;
  unit: string;
  lede: string;
  points: string[];
  cta: string;
  featured: boolean;
}[] = [
  {
    id: "stopwatch",
    kicker: "This week",
    name: "Stopwatch",
    price: "Scoped",
    unit: "one fee schedule",
    lede: "One clock. The gold row is written before anyone labels it.",
    points: [
      "Six adult-day therapy codes",
      "Manual seconds and script seconds",
      "Code, allowed dollars, mismatch notes",
      "Rows labeled by your SME",
    ],
    cta: "Design the run",
    featured: false,
  },
  {
    id: "parallel",
    kicker: "The parallel run",
    name: "Parallel",
    price: "$3",
    unit: "per claim, list shape",
    lede: "A weekly file beside the chart. A few centers. The chart stays put.",
    points: [
      "What the model coded",
      "What it priced",
      "What the desk left on the table",
      "No rip-out, no second chart",
    ],
    cta: "Run it in parallel",
    featured: true,
  },
  {
    id: "wrap",
    kicker: "After the delta",
    name: "Wrap",
    price: "Fraction",
    unit: "of a loaded coder",
    lede: "Price the desk as a per-claim wrap once the clock has a number.",
    points: [
      "Per claim, not a seat with a login",
      "Audit trail tied to the note",
      "Waiver and incident coding, second",
      "Quoted only after a measured run",
    ],
    cta: "Price the wrap",
    featured: false,
  },
];

export function PricingPage() {
  const [plan, setPlan] = useState<PlanId>("parallel");

  function choose(next: PlanId) {
    setPlan(next);
    document.getElementById("join")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Shell>
      <main>
        <section className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
          <p className="text-xs font-medium tracking-widest text-teal uppercase">Pricing</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Price the desk. Don’t rent another platform.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            List shape for the page, not a quote and not a savings claim. A real price follows a timed run.
          </p>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {PLANS.map((tier) => (
              <article
                key={tier.id}
                className={
                  tier.featured
                    ? "flex flex-col rounded-2xl border border-teal bg-paper-2 p-6 shadow-sm"
                    : "flex flex-col rounded-2xl border border-line bg-paper-2 p-6"
                }
              >
                <p className="text-xs font-medium tracking-widest text-teal uppercase">{tier.kicker}</p>
                <h2 className="mt-2 font-display text-3xl text-ink">{tier.name}</h2>
                <p className="mt-4 font-display text-4xl text-ink">{tier.price}</p>
                <p className="text-sm text-muted">{tier.unit}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted">{tier.lede}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-ink">
                  {tier.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choose(tier.id)}
                  className={
                    tier.featured
                      ? "mt-6 inline-flex h-12 items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep"
                      : "mt-6 inline-flex h-12 items-center justify-center rounded-full border border-muted px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-teal"
                  }
                >
                  {tier.cta}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section id="join" className="scroll-mt-24 bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="text-xs font-medium tracking-widest text-teal-ink uppercase">Call</p>
              <h2 className="mt-3 font-display text-3xl text-paper sm:text-5xl">
                Six codes. One national schedule.
              </h2>
              <p className="mt-5 max-w-md text-base leading-relaxed text-paper/80">
                De-identified text only. The gold-set row is written before a label exists. If it cannot be timed
                against the human desk, it does not ship.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-paper/80">
                <li>No live PHI on this list.</li>
                <li>No portal password. No scrape.</li>
                <li>No code off this schedule until the run has a number.</li>
              </ul>
            </div>
            <Signup plan={plan} onPlan={setPlan} />
          </div>
        </section>
      </main>
    </Shell>
  );
}

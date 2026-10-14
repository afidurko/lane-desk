import { Shell } from "./shell";
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
      "Physical, occupational, and speech therapy codes",
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
  return (
    <Shell>
      <main>
        <section className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
          <p className="text-[13px] text-muted">Pricing</p>
          <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">
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
                    : "flex flex-col rounded-[10px] bg-paper-2 p-6"
                }
              >
                <p className="text-[13px] text-muted">{tier.kicker}</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{tier.name}</h2>
                <p className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">{tier.price}</p>
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
      </main>
    </Shell>
  );
}

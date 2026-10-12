import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Page, PRIMARY, SECONDARY } from "@/components/ui";
import { PLANS, PRICING_DISCLAIMER, type PlanId } from "@/lib/billing/plans";

export function PricingPage() {
  const [card, setCard] = useState<readonly PlanId[]>([]);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/api/billing/status")
      .then((response) => (response.ok ? (response.json() as Promise<{ plans?: PlanId[] }>) : null))
      .then((json) => !cancel && setCard(Array.isArray(json?.plans) ? json.plans : []))
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  async function payByCard(plan: PlanId) {
    setBusy(plan);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !json.url) throw new Error(json.error ?? "Card payment is not available.");
      window.location.assign(json.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Card payment is not available.");
      setBusy(null);
    }
  }

  return (
    <Page
      kicker="Pricing"
      title="Three ways to work together"
      lede="Start with a short pilot on your own de-identified notes. The plans below show the shape of the pricing."
    >
      <p className="rounded-2xl border border-line bg-wash px-4 py-3 text-sm leading-relaxed text-ink" role="note">
        <strong className="font-medium">{PRICING_DISCLAIMER}</strong> Nothing is charged from this page.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.id === "stopwatch";
          return (
            <article
              key={plan.id}
              className={
                featured
                  ? "flex flex-col rounded-2xl border-2 border-teal bg-paper-2 p-5"
                  : "flex flex-col rounded-2xl border border-line bg-paper-2 p-5"
              }
            >
              <p className="text-xs font-medium tracking-widest text-teal uppercase">{plan.kicker}</p>
              <h2 className="mt-2 font-display text-2xl text-ink">{plan.name}</h2>
              <p className={plan.price.length > 12 ? "mt-3 font-display text-xl text-ink" : "mt-3 font-display text-3xl text-ink"}>
                {plan.price}
              </p>
              <p className="text-sm text-muted">{plan.unit}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{plan.lede}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-ink">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link to="/request" search={{ plan: plan.id }} className={`${featured ? PRIMARY : SECONDARY} mt-5`}>
                {featured ? "Request a pilot invoice" : "Request an invoice"}
              </Link>
              {card.includes(plan.id) ? (
                <button
                  type="button"
                  onClick={() => payByCard(plan.id)}
                  disabled={busy !== null}
                  className="mt-2 inline-flex h-11 items-center justify-center text-sm font-medium text-teal underline underline-offset-4"
                >
                  {busy === plan.id ? "Opening Stripe" : "Pay by card (test mode)"}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
      {error ? (
        <p className="mt-4 text-sm font-medium text-deep" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-8 text-sm leading-relaxed text-muted">
        Prices on the Medicare reference screens are not Lane prices. They are Medicare reference prices, not a payment, and they are never
        added to an invoice.
      </p>
    </Page>
  );
}

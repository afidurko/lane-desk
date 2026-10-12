/**
 * Plan list for the pricing screen. List shape only. This is not a quote, not a savings claim,
 * and not derived from a fee schedule. Aaron owns every number in this file.
 *
 * `price` is words, not a charge. Nothing here is billed until Stripe is turned on
 * (see docs/BILLING.md) and a client has asked for an invoice.
 */
export type PlanId = "stopwatch" | "parallel" | "wrap";

export type Plan = {
  id: PlanId;
  kicker: string;
  name: string;
  price: string;
  unit: string;
  lede: string;
  points: readonly string[];
  /** Stripe Checkout mode if card payment is switched on for this plan. */
  checkoutMode: "payment" | "subscription";
  /** Name of the env var that holds this plan's Stripe test-mode price id. Unset by default. */
  priceEnv: string;
};

export const PLANS: readonly Plan[] = [
  {
    id: "stopwatch",
    kicker: "Start here",
    name: "Stopwatch pilot",
    price: "Scoped",
    unit: "one fee schedule, one short pilot",
    lede: "A short pilot on your own de-identified notes. We time the coder and your desk on the same notes, side by side.",
    points: [
      "Physical, occupational, and speech therapy codes",
      "Our seconds and your seconds, each labeled",
      "Code, reference price, and mismatch notes",
      "Codes reviewed by your clinician before anyone relies on them",
    ],
    checkoutMode: "payment",
    priceEnv: "STRIPE_PRICE_STOPWATCH",
  },
  {
    id: "parallel",
    kicker: "After the pilot",
    name: "Parallel, per claim",
    price: "$3",
    unit: "per claim, list shape, not a quote",
    lede: "A weekly file next to your chart. A few centers. Your chart stays where it is.",
    points: [
      "The code the coder chose",
      "The Medicare reference price for it",
      "What differs from the vendor invoice",
      "No second chart and no rip-out",
    ],
    checkoutMode: "subscription",
    priceEnv: "STRIPE_PRICE_PARALLEL",
  },
  {
    id: "wrap",
    kicker: "Later",
    name: "Wrap",
    price: "Quoted after a measured run",
    unit: "per claim, shape only",
    lede: "Priced per claim once there is a measured run on your own notes. No price is set before that.",
    points: [
      "Per claim, not a seat with a login",
      "Each line tied back to the note",
      "Waiver and incident coding come second",
      "Terms reviewed before signing",
    ],
    checkoutMode: "subscription",
    priceEnv: "STRIPE_PRICE_WRAP",
  },
];

export const PLAN_IDS = PLANS.map((plan) => plan.id) as readonly PlanId[];

export function planOf(id: string | null | undefined): Plan | null {
  return PLANS.find((plan) => plan.id === id) ?? null;
}

export const PRICING_DISCLAIMER = "List shape only. Not a quote and not a savings claim. A price is agreed in writing after a pilot.";

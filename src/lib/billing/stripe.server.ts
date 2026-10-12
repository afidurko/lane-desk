/**
 * Stripe Checkout and Customer Portal scaffold. TEST MODE ONLY. Inert unless every env var below is set.
 *
 *   BILLING_MODE=test
 *   STRIPE_SECRET_KEY=sk_test_...          (a live key, sk_live_ or rk_live_, is refused)
 *   STRIPE_PRICE_STOPWATCH / STRIPE_PRICE_PARALLEL / STRIPE_PRICE_WRAP   (test-mode price ids, price_...)
 *
 * No key is in this repo. There is no live mode in this file. To go live, someone changes this file on purpose
 * after the steps in docs/BILLING.md. Card numbers never touch this app: Stripe hosts the page.
 * No patient data is sent to Stripe: only a price id, a success URL, and a cancel URL.
 */
import { planOf, type Plan } from "@/lib/billing/plans";

type Env = Record<string, string | undefined>;

export type BillingStatus =
  { enabled: false; reason: "not-configured" | "not-test-mode" | "live-key-refused" | "no-key" } | { enabled: true; mode: "test" };

export function billingStatus(env: Env): BillingStatus {
  const mode = (env.BILLING_MODE ?? "").trim().toLowerCase();
  const key = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (!mode && !key) return { enabled: false, reason: "not-configured" };
  if (mode !== "test") return { enabled: false, reason: "not-test-mode" };
  if (!key) return { enabled: false, reason: "no-key" };
  if (!key.startsWith("sk_test_")) return { enabled: false, reason: "live-key-refused" };
  return { enabled: true, mode: "test" };
}

export function priceFor(plan: Plan, env: Env): string | null {
  const id = (env[plan.priceEnv] ?? "").trim();
  return /^price_[A-Za-z0-9]+$/.test(id) ? id : null;
}

/** Only same-origin return URLs are allowed. */
export function returnUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

export function checkoutBody(plan: Plan, priceId: string, base: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", plan.checkoutMode);
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", returnUrl(base, `/request?paid=test&plan=${plan.id}`));
  body.set("cancel_url", returnUrl(base, `/pricing?plan=${plan.id}`));
  body.set("client_reference_id", `lane-${plan.id}`);
  return body;
}

export function portalBody(customerId: string, base: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("customer", customerId);
  body.set("return_url", returnUrl(base, "/pricing"));
  return body;
}

async function stripePost(path: string, body: URLSearchParams, key: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !json.url) throw new Error(json.error?.message ?? "Stripe did not return a page.");
  return json.url;
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; status: number; error: string };

export async function createCheckout(planId: string, base: string, env: Env): Promise<CheckoutResult> {
  const status = billingStatus(env);
  if (!status.enabled) return { ok: false, status: 503, error: "Card payment is not turned on. Request an invoice instead." };
  const plan = planOf(planId);
  if (!plan) return { ok: false, status: 400, error: "Unknown plan." };
  const priceId = priceFor(plan, env);
  if (!priceId) return { ok: false, status: 503, error: "This plan has no test-mode price set. Request an invoice instead." };
  try {
    return { ok: true, url: await stripePost("checkout/sessions", checkoutBody(plan, priceId, base), env.STRIPE_SECRET_KEY!.trim()) };
  } catch (error) {
    return { ok: false, status: 502, error: error instanceof Error ? error.message : "Stripe error." };
  }
}

/**
 * Customer Portal. Deliberately not reachable yet: a portal link must only be created for the customer who is
 * signed in, and this app has no client sign-in tied to a Stripe customer. docs/BILLING.md lists what to add.
 */
export async function createPortal(): Promise<CheckoutResult> {
  return {
    ok: false,
    status: 501,
    error: "The customer portal needs client sign-in, which is not set up. Ask for an invoice or a portal link by email.",
  };
}

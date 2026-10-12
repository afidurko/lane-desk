# Billing: test mode only

Two ways to get paid, both inert until someone chooses to turn them on.

1. **Request an invoice (works today, no setup).** `/request` takes company, contact, email, number of centers, and a plan from a fixed list. No free text, nothing stored,
   nothing sent. The person copies the summary, downloads it, or (if `VITE_INVOICE_REQUEST_EMAIL` is set) opens their own mail app. You send the invoice yourself.
2. **Stripe Checkout, test mode (scaffold).** `POST /api/billing/checkout {plan}` creates a hosted Stripe Checkout session. It runs only when **all** of these are set:
   `BILLING_MODE=test`, `STRIPE_SECRET_KEY=sk_test_...`, and that plan's `STRIPE_PRICE_STOPWATCH|PARALLEL|WRAP=price_...`.
   Any `sk_live_` / `rk_live_` key is refused. There is no live mode in the code. Only a price id and return URLs go to Stripe: no names, emails, or patient data.
   The card button on `/pricing` appears only for plans with a test price set.

**Customer Portal:** `POST /api/billing/portal` returns 501 on purpose. A portal link must only be made for the signed-in customer, and Lane has no client sign-in tied to a Stripe customer.
To add it: sign-in for clients, store `stripe_customer_id` per client, create the portal session for that id only.

**To turn on test mode:** in Stripe's dashboard (test mode) create one product and price per plan, put the three `price_...` ids and the `sk_test_...` key in the host's environment, set `BILLING_MODE=test`.
Pay with Stripe's test card 4242 4242 4242 4242. **To go live** someone must change `billingStatus()` in `src/lib/billing/stripe.server.ts` on purpose, add webhook handling and customer storage, and get terms and tax settled. That is not done here.

The plan text and the `$3` per claim are placeholders from the earlier landing page. They are in `src/lib/billing/plans.ts` and Aaron owns them. They are not derived from any fee schedule.

Tests: `scripts/demo-check.mjs` stubs `fetch` and proves: no env = no network call; live key = refused; test env = exactly one call to Stripe with only price id and URLs; portal = 501.

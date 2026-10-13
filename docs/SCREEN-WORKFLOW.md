# Screen workflow

Lane covers **New York only**. Every price is a **Medicare reference price, not a payment** (PACE is capitated).
Public build: national 2026 amounts, six screens. Internal build (`VITE_DEMO_MODE=internal`): New York locality prices
(Rest of NY 13282/99 default; Manhattan, NYC suburbs/Long Island, Poughkeepsie/N NYC suburbs, Queens, from the loaded file), older years, internal screens.

Journey: Try a note → Check an invoice → Request a pilot. A step strip shows it on those three screens.

| Screen | Who and why | One main action | Empty | Error | Result |
|---|---|---|---|---|---|
| `/` Home | First-time visitor. Say what it is in two lines. | Try a sample note | n/a | n/a | Three steps, four ground rules |
| `/desk` Try a note | Reviewer. See a code and its reference price for a made-up note. | Price this note | "Nothing has run yet" | Fee file did not load; identifier refused (nothing kept) | Code, service, units, reference price, total, our measured seconds; manual desk side stays blank |
| `/invoice` Check an invoice | Reviewer. Which vendor lines match the file amount? | Check the invoice | "Nothing checked yet" | No code found; fee file down; identifier refused | Lines grouped by schedule: matches, over/under by $, file amount. Public: 2026 only |
| `/code` Look up a code | Anyone. What is this code and what is its reference price? | Type a code (3 sample chips) | "Type a code" | Not on file; file down; bad format | Name from the file, 2026 reference price (internal: every year) |
| `/proof` Proof | Skeptical reader. | Run the timing | "Not run yet" | Proof file / fee file did not load | Price check table per year (from `public/proof.json`), our timing, manual side "Not yet timed", "Not proven yet" list |
| `/about` What this is | Anyone. Is/isn't, coverage, sources, review status. | Try a sample note | n/a | file list did not load | Plain statement, **coverage: New York only** |
| `/pricing` Pricing | Buyer. | Request a pilot invoice (featured plan) | n/a | Card payment unavailable | Three plans, list shape, "not a quote" |
| `/request` Request | Buyer. Four fields and a plan. | Prepare my request | "Nothing yet" | Inline field errors | Summary to copy, download, or open in own email app. Nothing sent or stored |

Internal-only screens (closed with a plain notice in public, and their code is not shipped): claim worksheet `/billing`, code book `/book`,
filter `/filter`, `/ny`, file status `/ops`, `/team`, `/compete`, rules `/operate`, `/why`, `/run`.

Design rules used on every screen: one h1, one primary button, plain words, labels tied to inputs, visible focus ring, 44px touch targets,
no sideways scroll at 375px, the reference-price sentence next to every price.

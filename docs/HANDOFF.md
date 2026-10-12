# Handoff: branch `lane-workflow-billing` (local only, not pushed)

**Scope (Aaron): New York only.** Default locality Rest of NY, MAC 13282, locality 99. The other four NY localities in the loaded file
(Manhattan, NYC suburbs/Long Island, Poughkeepsie/N NYC suburbs, Queens) are selectable in the internal build only. No other state is offered anywhere.

## Run it
```
npm install          # Node 22.12+ (engines). `npm ci` fails on main already: the lockfile is out of sync, unrelated to this branch.
npm run dev          # http://localhost:8080  public mode (national 2026 reference prices)
VITE_DEMO_MODE=internal npm run dev     # internal: NY localities, older years, internal screens
npm run build        # production build; in public mode it also deletes held-back files and unused screens from the output
npm run lint && npm run typecheck && npm run check     # all pass (see docs/evidence/)
npm run preview & BASE_URL=http://127.0.0.1:8081 npm run e2e    # browser walk-through of the demo path, desktop + phone
```

## What was verified (real runs, files in `docs/evidence/`)
- Lint: 0 errors (8 pre-existing warnings). Typecheck: clean. `npm run check`: 20,097 + 35 + 542 + 6 + 58 assertions, 0 failures.
- Price proof: 55,076 payable codes across 7 years recomputed from component RVUs, 0 differences; a deliberate 1-cent error is caught. Rest of NY year files and the 61-code therapy table also 0 differences.
- Browser walk-through, public production build: 116 checks pass at 1280px and 375px (flows, refusals, no sideways scroll, no dead links, skip link and focus ring, one primary button per page, no request for any held-back file).
  Internal dev: 120 checks pass, including Rest of NY 97110 = file amount, Manhattan from the same file, exactly five NY localities.
- Public build output contains: `pfs-national-2026.json`, `proof.json`, images, app code. No CLFS, no year shards, no NY Medicaid, no locality/GPCI table, none of the typed Rest of NY amounts (searched the built output).

## Needs a decision from Aaron / Shield / Andrea
1. **The GitHub repo `afidurko/lane-desk` is public (`private: false`) and `main` already contains `public/clfs-*.json`, `public/years/lab/`, and all Rest of NY data.** Pruning only protects a deployed build. If the lab files or RoNY figures must not be public, make the repo private or remove them from history. I did not touch the remote.
2. **Never expose `npm run dev` outside the machine** (tunnel, shared link). Dev serves `/public` as is, so held-back files are reachable by URL. Demos to others should be the deployed build or `npm run preview`.
3. Deploy: the Vercel build must run `npm run build` with `VITE_DEMO_MODE` unset or `public`. The pruning is part of that script. Not deployed from here.
4. Public numbers are **national**, so they differ from New York's (97110: national $29.06 vs Rest of NY $28.27, both from the files). The About page says so. If the demo should show NY numbers, that is the "cleared" step.
5. Plans and the `$3` per claim are placeholders from the earlier landing page (`src/lib/billing/plans.ts`). Nothing derives them. Aaron owns them.
6. CMS short descriptions are shown as the code names, with an AMA/CPT trademark line. Someone should confirm that is acceptable for public use.

## Not done / not proven (say these out loud)
- **Stripe was never called for real.** No test key was available. Request bodies are unit-tested against a stubbed `fetch` and follow Stripe's documented form fields, but a real test-mode session has not been created. Customer Portal returns 501 on purpose (no client sign-in). See `docs/BILLING.md`.
- **Coder accuracy is unmeasured.** It is a phrase-matching rule coder; it ships labeled "rule-based coder, provisional". Its time (microseconds per note) is real but says nothing about a human desk. The manual-desk side is blank by design.
- **Identifier screen is pattern-based.** It refuses record numbers, birth dates, phones, emails, long digit strings. It cannot recognize a name. The UI says so. Invoice lines carry a date of service, which is identifying when combined with other facts.
- Internal screens (`/billing /book /filter /ny /ops /team /compete /operate /why /run`) were kept working and closed in public, but I did not re-review their copy for overclaims.
- `npm test` still has 18 failing platform-template tests (they look for `.grok/skills/og` and `/migrations`, which this repo does not have). Same 18 before and after; not touched. Use `npm run check`.
- `src/components/desk/desk-scan.tsx` is now unused. The old landing page, signup form, and the client-side access-code gate (`olean-13282`) were deleted as dead code.
- I looked at screenshots of home, desk, invoice, code, proof, pricing, request on desktop and desk on phone. Phone overflow was tested numerically on every public page, not viewed on every page.

## To publish
Review `git log lane-workflow-billing`, then push and open a PR yourself. Nothing was pushed or sent.
`npm run proof` regenerates `public/proof.json` and `public/proof-internal.json` if any fee file changes. `node scripts/build-national.mjs` regenerates the public physician file (`npm run check` fails if it is stale).

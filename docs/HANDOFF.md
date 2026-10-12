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
- Lint: 0 errors (9 warnings, all react-refresh/pre-existing style). Typecheck: clean. `npm run check`: 20,097 + 35 + 542 + 94 (price-regression, includes the 2020 NY checks) + 6 + 58 assertions, 0 failures. `npm run check:key`: 10 samples, 0 differences. `npm run check:ny2020` (needs the sqlite): 91,130 cells, 0 differences. Browser walk-through: 134 public checks and 144 internal checks pass. Evidence: `docs/evidence/ny2020-and-tests/`.
- Price proof: 55,076 payable codes across 7 years recomputed from component RVUs, 0 differences; a deliberate 1-cent error is caught. Rest of NY year files and the 61-code therapy table also 0 differences.
- Browser walk-through, public production build: 134 checks pass at 1280px and 375px (flows, refusals, no sideways scroll, no dead links, skip link and focus ring, one primary button per page, no request for any held-back file).
  Internal dev: 140 checks pass, including Rest of NY 97110 = file amount, Manhattan from the same file, exactly five NY localities.
- Public build output contains: `pfs-national-2026.json`, `proof.json`, images, app code. No CLFS, no year shards, no NY Medicaid, no locality/GPCI table, none of the typed Rest of NY amounts (searched the built output).

## Claims Wedge price check, 2026-10-12: what changed (commits `6226234`..HEAD, local only)
Their report: single-code prices match CMS (0 mismatches). Four display problems, fixed in this order. Outputs are in `docs/evidence/price-check-fixes/`.
1. **Therapy MPPR.** Full rate on the therapy unit with the highest non-facility practice-expense RVU; practice expense x 0.5 on every other therapy unit; each unit rounded to the cent (the answer key's rule). Applied on the **desk**, the **invoice checker** (lines with the same date = one patient's day, one unit each; an undated line is priced alone at the full rate), and the **claim worksheet** (a claim is one date; also the intake parser, the verifier, safe-fixes and the packet). Medicaid claims are not reduced. Every screen says "Multiple-procedure payment reduction applied" when a cut was made. Which codes: CMS MULT PROC indicator 5 (52 codes in 2026), added to the fee files as `mu` by `scripts/build-flags.mjs`. Results: sample-01 national **$95.69** (was $116.24), Rest of NY **$93.58** (was $113.08); 97110+97112+97140 national **$76.15** (was $89.51), Rest of NY $74.40. `npm run check:key` prices all 10 answer-key samples with the app: 0 differences, national and Rest of NY.
2. **Note reader double count.** A line that names a service and also writes its code was counted twice. `linesOf` now takes one count per line of the note. "Therapeutic exercise (97110), 45 minutes, 3 units" prices 3 units. Two separate lines of one service still add.
3. **Non-facility NA.** 4,043 payable codes in 2026 (flag `nn` from CMS "NON-FAC NA INDICATOR = NA"; same flag for every year) get **no office price**: the desk, invoice checker, Code screen, worksheet and intake say "Not priced in the office setting" and leave them out of totals. Public national file: 7,745 priced codes became 3,702. None of the 61 therapy codes is affected. Facility NA (`fn`) is loaded but nothing shows facility amounts in public, so it is not used yet.
4. **97026.** Typed table said `separate: false`, $0. Now separate, $6.36 Rest of NY / $6.68 national. A loaded file now decides what is payable; the typed "not separate" flag only applies to the typed fallback. Found while fixing it: the internal Rest of NY rate map priced bundled (status B) codes such as 97010 from their RVUs; it now pays only statuses A, R, T.
Also: the proof recomputes the reduction values and counts NA codes (`proof.json` now has `codesNotOffice`); proof still 55,076 codes, 0 differences. One pre-existing bug fixed because the new e2e hit it: duplicate React key for two alerts on one worksheet line.

### Limits that remain (also on the About page in plain words)
- **Prices use the year-end release.** For each year the app loads the last (D) release, not the January release. 2024 dates of service from Jan 1 to Mar 8 used an earlier conversion factor: 97110 Rest of NY is **$28.03** in the CMS January 2024 file, **$28.49** in the app. Other quarters match for the 27 codes Claims Wedge checked. The public About page says this without dollar figures; the internal About page names the 2024 gap and says 2020 NY localities came from the sqlite.
- **2020 New York localities: closed.** The 2020 file already carried the five NY localities with their GPCIs but no state label, so the app never offered them. `scripts/load-ny-2020.mjs` checks all five against the CMS-Codes-checked `pfs_ny_history.sqlite` (RVU20D: MAC, locality, name, work/PE/MP GPCI) and labels exactly those rows `NY` (nothing else in the file changed). 2020 localities were loaded from that sqlite. `scripts/check-ny-2020.mjs` compares 91,130 non-facility and facility cells (all payable codes and modifiers x 5 localities) with the sqlite: 0 differences; the year shard the Code screen and invoice checker read matches the sqlite for all 7,341 Rest of NY codes (NA codes show no office price). Therapy codes 97110/97112/97116/97140/97150/97161 x 5 localities are also fixed in `price-regression`. Internal mode only; the public build is unchanged (national 2026 only).
- MPPR is by date of service and assumes one patient per invoice/claim. An invoice with several patients on one date would be reduced too much; the invoice screen says how lines are grouped. The typed 61-code table (used only when no file is loaded, and by `lane-check`) has no RVU components, so it cannot apply MPPR; no screen uses it.
- The public national file now carries work, practice-expense and malpractice RVUs for the 52 therapy-indicator codes (needed for the cut). They are national CMS RVUs, no locality data.
- `build-flags.mjs` and `build-years.mjs` read CMS files from `/workspace/healthcare-pfs/raw/ny_history`; the output is committed.
- `npm test` is green: 191 node tests + lane-check (20,097) + billing-check (35) + sim-check (542) + 55 app-data/auth tests, 0 failures. See "npm test: the 18 failures" below.

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
- `src/components/desk/desk-scan.tsx` is now unused. The old landing page, signup form, and the client-side access-code gate (`olean-13282`) were deleted as dead code.
- I looked at screenshots of home, desk, invoice, code, proof, pricing, request on desktop and desk on phone. Phone overflow was tested numerically on every public page, not viewed on every page.

## To publish
Review `git log lane-workflow-billing`, then push and open a PR yourself. Nothing was pushed or sent.
`npm run proof` regenerates `public/proof.json` and `public/proof-internal.json` if any fee file changes. `node scripts/build-national.mjs` regenerates the public physician file (`npm run check` fails if it is stale).


## npm test: the 18 failures (all resolved, none were Lane code)

The repo lacks the platform template's `.grok/` folder (gitignored, never committed), `migrations/` and `server/`. 18 template tests looked for them. 6 were dead and deleted, 12 were real tests that depended on the clone's contents and were made hermetic. Before: 197 tests, 179 pass, 18 fail, and the chained lane-check/billing-check/sim-check never ran. After: 191 tests, 191 pass.

Deleted (6 test cases; the rest of each file stays):
- `scripts/brand-check.test.mjs`: "SKILL.md and AGENTS.md name the marker path and bound this script uses", "the sections that own the brand-task prohibition never affirm a wait", "SKILL.md tells the pass to self-check with the flag this CLI accepts" (plus their helpers). They check wording in `.grok/skills/og/SKILL.md`, a template agent skill this repo does not have. The brand-check script's own tests (26) stay.
- `scripts/write-atomic.test.mjs`: "every hand-over the og skill prints is one this script accepts". It reads `.grok/skills/og/references`, same absent skill.
- `scripts/migration-plan.test.mjs`: "the auth schema ships outside the globbed directory". It reads `migrations/auth/0001_auth.sql`; Lane has no database and no `migrations/` folder. The migration-planner logic tests stay.
- `scripts/with-app-env.test.mjs`: "the template ships auth off". It asserts the content of `.grok/app-env.json`, a gitignored file that is not in this repo. The wrapper's logic tests stay.

Fixed, not deleted (real code under test):
- `scripts/grok-pwa-plugin.test.mjs` (8 tests): the head injector reads `src/lib/og/site.json` and `public/og.jpg` from the working directory when no cwd is passed, and this repo has Lane's real title and card there, so tests expecting the document title or the placeholder card failed. They now run in an empty temp workspace by default; tests that pass their own cwd or site are unchanged. One more, "nitro middleware and its bundled assets exist", asserted `server/middleware/grok-pwa.ts`, which this repo does not have; it is now "the install page and its bundled assets exist" and keeps the three asset checks. The Nitro `serverDir` that this test file guarded was removed; see "Vercel build" below.
- `scripts/with-app-env.test.mjs` (2 tests: wrapped command applies the app env, and via a symlinked path) and `scripts/check-auth-invariant.test.mjs` (1 test: build side resolves the app-env): they read the untracked `.grok/app-env.json`. They now write their own in a temp project, and the wrapper test runs a copy of the wrapper there. Nothing asserted was loosened.
- `package.json` `test`: lane-check, billing-check and sim-check now run with `VITE_DEMO_MODE=internal`, the same as `npm run check`. billing-check is an internal-mode check (it expects the internal Rest of NY amounts) and had never run under `npm test` because the earlier failures stopped the chain; run in public mode it failed one assertion, which was the mode, not a bug.

## Vercel build (what the deploy is, and the Nitro fix)

- **Fix:** `vite.config.ts` had `nitro({ preset: "vercel", serverDir: "./server" })`, but this repo has no `server/` folder (that was for the template's PWA install page and manifest middleware, which Lane does not use). It is now `nitro({ preset: "vercel" })`. The build output was identical before and after (89 files); the old setting named a folder that did not exist. `scripts/grok-pwa-plugin.test.mjs` used to require the `serverDir` line; that test now requires the Vercel preset and fails if `serverDir` ever names a missing folder.
- **What Vercel deploys:** `vercel.json` runs `npm install` then `npm run build`. The build is `vite build` (Nitro writes `.vercel/output`, Build Output API v3) then `db:migrate` (skips with no `DATABASE_URL`) then `prune:public`. Output: `.vercel/output/static` (assets, `pfs-national-2026.json`, `proof.json`, icons; **no `index.html`**) and `.vercel/output/functions/__server.func` (Node 22, renders every page on the server). `config.json` sends everything that is not a static file to that function, so every route works on direct load and refresh, and no SPA rewrite is needed. An unknown path returns HTTP 404 with a Lane page: "We couldn't find that page.", one primary link ("Back to the start") and links to Try a note, Check an invoice and Request a pilot, in the same header and footer as other screens. It never repeats the requested path. Source: `src/components/pages/not-found-page.tsx`, wired as the root `notFoundComponent`; the e2e checks it in public and internal modes at desktop and phone width. No price or data file changed.
- **Public build, `VITE_DEMO_MODE` unset:** pruning is unchanged (13 unused screens and 101 held-back files removed, 61 kept). `npm run check:output` after a build checks the output: routes fall through to the function; no year shards, lab, Medicaid, other-year or locality files; `pfs-national-2026.json` has no localities; none of 242 distinct NY locality therapy amounts appears in any built script. It fails on an internal build (negative control, 4 failures).
- **Not run here:** the Vercel CLI (`vercel build`), because it needs the user's Vercel login. I ran the same commands Vercel runs from a clean `git clone` (no `node_modules`, no `.grok`, `VERCEL=1 CI=1`, Node 22): `npm install` then `npm run build`, exit 0, same file list as the working-tree build.
- **Preview:** `npm run preview` serves the built output at `http://127.0.0.1:8081` (public unless built with `VITE_DEMO_MODE=internal`). Run `npm run build` first.

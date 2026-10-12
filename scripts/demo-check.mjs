/**
 * Checks for the demo path: mode flag, held-back files, national prices, plans, invoice request, and the inert Stripe scaffold.
 * Runs with: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/demo-check.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveMode, REFERENCE_NOTE, NEVER_PUBLIC, INTERNAL_ONLY, visibleYears } from "../src/lib/config/mode.ts";
import { nyLocalities, DEFAULT_LOCALITY, keyOf } from "../src/lib/config/ny.ts";
import { indexNational, ratesOf } from "../src/lib/pricing/national.ts";
import { sampleInvoice } from "../src/lib/demo/invoice-sample.ts";
import { SAMPLES } from "../src/lib/demo/samples.ts";
import { fromFile, allowedOf, review } from "../src/lib/desk/clock.ts";
import { describeCode } from "../src/lib/lookup/describe.ts";
import { runLane } from "../src/lib/desk/lane.ts";
import { PLANS, planOf } from "../src/lib/billing/plans.ts";
import { validateRequest, summaryText, mailtoLink } from "../src/lib/billing/invoice-request.ts";
import { billingStatus, createCheckout, createPortal, checkoutBody, priceFor } from "../src/lib/billing/stripe.server.ts";

const failures = [];
let ran = 0;
const check = (name, ok) => {
  ran += 1;
  if (!ok) failures.push(name);
};

// DEMO_MODE: public unless explicitly internal.
check("mode default is public", resolveMode(undefined) === "public" && resolveMode("") === "public");
check("mode junk is public", resolveMode("INTERNAL ") === "internal" && resolveMode("yes") === "public" && resolveMode("private") === "public");
check("public shows 2026 only", visibleYears([2026, 2025, 2020], "public").join() === "2026");
check("internal shows all years", visibleYears([2026, 2025, 2020], "internal").length === 3);
check("reference sentence is fixed", REFERENCE_NOTE === "Medicare reference price, not a payment");

// Held-back files.
const never = ["clfs-2026.json", "clfs-2020.json", "years/lab/0.json", "years/lab/G.json"];
check("lab files are never public", never.every((path) => NEVER_PUBLIC.some((rule) => rule.test(path))));
const internal = ["years/physician/9.json", "years/ambulance/A.json", "once/9.json", "ny-medicaid.json", "ny-more.json", "pfs-2025.json", "pfs-2026.json", "afs-2026.json", "dme-2026.json", "proof-internal.json", "gap-rates.json", "found-rates.json"];
check("Rest of NY and other internal data is held back", internal.every((path) => INTERNAL_ONLY.some((rule) => rule.test(path))));
const keep = ["pfs-national-2026.json", "proof.json", "favicon.svg", "og.jpg"];
check("the national 2026 file and proof stay", keep.every((path) => ![...NEVER_PUBLIC, ...INTERNAL_ONLY].some((rule) => rule.test(path))));

// New York only.
const pfs = JSON.parse(readFileSync("public/pfs-2026.json", "utf8"));
const ny = nyLocalities(pfs.localities);
check("only NY localities are offered", ny.length === 5 && ny.every((item) => item.state === "NY"));
check("default locality is Rest of NY 13282/99", DEFAULT_LOCALITY.key === "13282/99" && ny.some((item) => keyOf(item) === "13282/99"));
check("NYC localities come from the loaded file", ["13202/01", "13202/02", "13292/04"].every((key) => ny.some((item) => keyOf(item) === key)));

// National 2026 prices come from the file.
const national = indexNational(pfs);
const slim = JSON.parse(readFileSync("public/pfs-national-2026.json", "utf8"));
check("public national file has no locality table and no component RVUs", !("localities" in slim) && !("anesthesia" in slim) && Object.keys(slim.rows[0]).sort().join() === "c,d,m,s,tn");
check("public national file prices identically to the full file", [...indexNational(slim).rows].every(([code, row]) => row.a["2026"] === national.rows.get(code).a["2026"]) && indexNational(slim).rows.size === national.rows.size);
check("national 97110 is the file total times the factor", national.rows.get("97110").a["2026"] === Math.round(0.87 * 33.4009 * 100));
check("a bundled code has no national amount", Object.values(national.rows.get("0001F").a)[0] === null);
check("national keeps no modifier rows", [...national.rows.keys()].every((code) => !code.includes("-")));
const rates = ratesOf(national);
check("rates only hold priced codes", rates["97110"] === 29.06 && rates["0001F"] === undefined);

// The clock never falls back to the typed Rest of NY table when it has a file map.
const marked = fromFile({ ...rates });
delete marked["97140"];
check("file map: missing code is zero, not the typed NY amount", allowedOf(1, "97140", marked) === 0);
check("plain map still falls back (internal path unchanged)", allowedOf(1, "97140", {}) === 26.97);
const lane = runLane(SAMPLES[0].note, null, null, fromFile(rates));
check("sample note prices at the national 2026 file amount", lane.lines.length === 1 && lane.lines[0].code === "97110" && lane.lines[0].allowed === 29.06);
check("sample note differs from the Rest of NY amount", lane.lines[0].allowed !== 28.27);
check("two services both priced", runLane(SAMPLES[1].note, null, null, fromFile(rates)).lines.length === 2);
check("minutes become units", runLane(SAMPLES[2].note, null, null, fromFile(rates)).lines[0]?.units === 2);
check("identifier sample is refused", review(SAMPLES.find((sample) => sample.id === "refused").note, fromFile(rates)).gate === "phi" || runLane(SAMPLES.find((sample) => sample.id === "refused").note, null, null, fromFile(rates)).lines.length === 0);

// Public wording shows 2026 national only, never an older year or Rest of NY.
const told = describeCode("Physician", { n: "Therapeutic exercises", s: "A", a: { "2020": 3047, "2026": 2906 } });
check("public description is national 2026 only", told.includes("national") && told.includes("$29.06") && !told.includes("$30.47") && !/Rest of New York/.test(told));

// Sample invoice: derived from the file.
const inv = sampleInvoice((code) => national.rows.get(code)?.a["2026"] ?? undefined, 2026);
const invLines = inv.text.split("\n");
check("sample invoice line 1 is the file amount", invLines[1].endsWith(`,${(national.rows.get("97110").a["2026"] / 100).toFixed(2)}`));
check("sample invoice line 2 is deliberately over", Number(invLines[2].split(",")[2]) > national.rows.get("97140").a["2026"] / 100);

// No typed-in dollar figure in the demo screens.
function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
const demoFiles = [...files("src/components/pages"), ...files("src/components/desk"), ...files("src/components/lookup"), "src/components/ui.tsx", "src/lib/demo/samples.ts", "src/lib/demo/invoice-sample.ts", "src/lib/demo/timing.ts"];
const figures = demoFiles.filter((file) => /\$\d/.test(readFileSync(file, "utf8")));
check(`no typed dollar figure in demo screens (${figures.join(",") || "none"})`, figures.length === 0);
check("no 186.40 anywhere in source", files("src").every((file) => !readFileSync(file, "utf8").includes("186.40")));

// Plans.
check("three plans in order", PLANS.map((plan) => plan.id).join() === "stopwatch,parallel,wrap");
check("plans say list shape", PLANS.every((plan) => plan.unit.length > 0) && planOf("nope") === null);

// Request an invoice.
const good = { company: "Example PACE", contact: "Pat Example", email: "pat@example.org", centers: "3", plan: "parallel" };
check("valid request passes", validateRequest(good).ok === true);
check("request is only four fields and a plan", Object.keys(validateRequest(good).request).sort().join() === "centers,company,contact,email,plan");
check("empty request fails every field", Object.keys(validateRequest({ company: "", contact: "", email: "", centers: "", plan: "" }).errors).length === 5);
check("centers must be a whole number", !validateRequest({ ...good, centers: "2.5" }).ok && !validateRequest({ ...good, centers: "0" }).ok && !validateRequest({ ...good, centers: "9999" }).ok);
check("bad email fails", !validateRequest({ ...good, email: "pat@" }).ok);
check("unknown plan fails", !validateRequest({ ...good, plan: "gold" }).ok);
check("identifier in a name field is refused", !validateRequest({ ...good, company: "MRN 12345678" }).ok && !validateRequest({ ...good, contact: "123-45-6789" }).ok);
check("markup in a name is refused", !validateRequest({ ...good, company: "<b>Acme</b>" }).ok);
const text = summaryText(validateRequest(good).request);
check("summary carries only those fields", text.includes("Example PACE") && text.includes("Number of centers: 3") && text.includes("No patient information"));
check("no mailto without an address", mailtoLink(undefined, validateRequest(good).request) === null);
check("mailto with an address", mailtoLink("sales@example.org", validateRequest(good).request)?.startsWith("mailto:sales@example.org?subject=") === true);

// Stripe scaffold is inert.
check("billing off with no env", billingStatus({}).enabled === false && billingStatus({}).reason === "not-configured");
check("billing off in live mode", billingStatus({ BILLING_MODE: "live", STRIPE_SECRET_KEY: "sk_live_x" }).enabled === false);
check("a live key is refused even in test mode", billingStatus({ BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_live_x" }).reason === "live-key-refused");
check("a restricted live key is refused", billingStatus({ BILLING_MODE: "test", STRIPE_SECRET_KEY: "rk_live_x" }).enabled === false);
check("a key without test mode is off", billingStatus({ STRIPE_SECRET_KEY: "sk_test_x" }).enabled === false);
check("test key and test mode is on", billingStatus({ BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x" }).enabled === true);
let calls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls += 1;
  globalThis.__last = { url: String(url), init };
  return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/test_123" }), { status: 200 });
};
const off = await createCheckout("stopwatch", "http://localhost:8080", {});
check("checkout with no env: refused, no network", off.ok === false && off.status === 503 && calls === 0);
const noPrice = await createCheckout("stopwatch", "http://localhost:8080", { BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x" });
check("checkout with no price id: refused, no network", noPrice.ok === false && calls === 0);
const badPlan = await createCheckout("gold", "http://localhost:8080", { BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_STOPWATCH: "price_1" });
check("checkout with an unknown plan: refused", badPlan.ok === false && badPlan.status === 400 && calls === 0);
const live = await createCheckout("stopwatch", "http://localhost:8080", { BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_STOPWATCH: "price_1" });
check("checkout with a live key: refused, no network", live.ok === false && calls === 0);
const on = await createCheckout("stopwatch", "http://localhost:8080", { BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_PRICE_STOPWATCH: "price_123" });
check("checkout with test env: one call to Stripe, returns the hosted page", on.ok === true && calls === 1 && globalThis.__last.url === "https://api.stripe.com/v1/checkout/sessions");
const sent = String(globalThis.__last.init.body);
check("only a price id and return urls go to Stripe", sent.includes("line_items%5B0%5D%5Bprice%5D=price_123") && !/email|name|patient/i.test(sent));
check("checkout mode matches the plan", checkoutBody(planOf("stopwatch"), "price_1", "http://x").get("mode") === "payment" && checkoutBody(planOf("parallel"), "price_1", "http://x").get("mode") === "subscription");
check("price id must look like a price id", priceFor(planOf("wrap"), { STRIPE_PRICE_WRAP: "bad id" }) === null);
globalThis.fetch = realFetch;
const portal = await createPortal();
check("portal is not reachable", portal.ok === false && portal.status === 501);
check("no Stripe key is in the source tree", files("src").concat(files("scripts")).every((file) => !/sk_(test|live)_[A-Za-z0-9]{8,}/.test(readFileSync(file, "utf8"))));

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

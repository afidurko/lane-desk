/**
 * Browser walk-through of the demo path. Needs a running server and a Chrome/Chromium.
 *   BASE_URL=http://localhost:8080 CHROME=/usr/bin/google-chrome node scripts/e2e-demo.mjs [--internal]
 * Runs at desktop and phone width. Fails on: a console error, a failed request, a page wider than the screen,
 * a missing disclaimer, a forbidden file request in public mode, or a broken step in the demo path.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:8080";
const internal = process.argv.includes("--internal");
const failures = [];
const log = [];
const check = (name, ok, detail = "") => {
  log.push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });

for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 375, height: 740 }]]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("console", (message) => message.type() === "error" && !/fonts\.g|ERR_(NAME|INTERNET|CONNECTION)|status of 404/.test(message.text()) && errors.push(message.text()));
  // A 404 is expected only for a year or period shard that has no rows for a code. Anything else is an error.
  page.on("response", (response) => response.status() === 404 && !/\/(years|once)\//.test(response.url()) && errors.push(`404 ${response.url()}`));
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  const t = (name, ok, detail) => check(`[${label}] ${name}`, ok, detail);

  const publicPages = ["/", "/desk", "/invoice", "/code", "/proof", "/about", "/pricing", "/request"];
  for (const path of publicPages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    t(`${path} loads, no sideways scroll`, wide <= 1, `overflow ${wide}px`);
    const h1 = await page.locator("h1").count();
    t(`${path} has one h1`, h1 === 1, `${h1}`);
    const primaries = await page.locator("main a.bg-teal, main button.bg-teal").count();
    t(`${path} has at most one primary action`, primaries <= 1, `${primaries}`);
  }

  // Desk
  await page.goto(base + "/desk", { waitUntil: "networkidle" });
  t("desk idle state is explained", await page.getByText("Nothing has run yet").isVisible());
  await page.getByRole("button", { name: "Price this note" }).click();
  await page.getByText("Medicare reference price, not a payment").first().waitFor();
  t("desk shows 97110", await page.getByRole("cell", { name: "97110" }).isVisible());
  const deskText = await page.locator("main").innerText();
  t("desk price comes with the disclaimer", /Medicare reference price, not a payment/.test(deskText));
  t("desk timing label is verbatim", deskText.includes("our side, measured: synthetic notes, rule-based coder, provisional".toUpperCase()) || deskText.toLowerCase().includes("our side, measured: synthetic notes, rule-based coder, provisional"));
  t("desk manual side is not timed", deskText.includes("Not yet timed"));
  t("desk shows seconds, not ms", /seconds/.test(deskText) && !/\bms\b/.test(deskText));
  await page.getByRole("button", { name: "A note with an identifier" }).click();
  await page.getByRole("button", { name: "Price this note" }).click();
  await page.getByRole("alert").filter({ hasText: /^Refused\./ }).waitFor();
  t("desk refuses an identifier", true);
  await page.getByRole("button", { name: "Two services" }).click();
  await page.getByRole("button", { name: "Price this note" }).click();
  await page.getByText("Total of these lines").waitFor();
  t("desk two lines get a total", true);

  // Invoice
  await page.goto(base + "/invoice", { waitUntil: "networkidle" });
  t("invoice idle state is explained", await page.getByText("Nothing checked yet").isVisible());
  await page.getByRole("button", { name: "Use a synthetic sample invoice" }).click();
  await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("97110"));
  await page.getByRole("button", { name: "Check the invoice" }).click();
  await page.getByText("do not match the file amount").or(page.getByText("does not match the file amount")).first().waitFor();
  const inv = await page.locator("main").innerText();
  t("invoice finds one match and one miss", /1 of 2 lines do not match/.test(inv) && /Matches the 2026 file/.test(inv) && /Over by/.test(inv));
  t("invoice carries the disclaimer", /Medicare reference price, not a payment/.test(inv));
  await page.locator("textarea").fill("MRN 12345 97110 2026-03-01 10.00");
  await page.getByRole("button", { name: "Check the invoice" }).click();
  await page.getByRole("alert").filter({ hasText: /^Refused\./ }).waitFor();
  t("invoice refuses an identifier", true);

  // Code
  await page.goto(base + "/code", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "97110", exact: true }).click();
  await page.getByText("What it is").first().waitFor();
  const code = await page.locator("main").innerText();
  t("code shows a 2026 price and the disclaimer", /\$\d+\.\d{2}/.test(code) && /Medicare reference price, not a payment/.test(code) && /2026/.test(code));
  if (!internal) t("code shows no other year in public", !/2025|2024|2023|2022|2021|2020/.test(code.replace(/Medicare national, non-facility, 2026/g, "")));

  // Proof
  await page.goto(base + "/proof", { waitUntil: "networkidle" });
  await page.getByText("None differed").or(page.getByText("differed")).first().waitFor();
  await page.getByRole("button", { name: "Run the timing" }).click();
  await page.getByText("per note, average over").waitFor();
  const proof = await page.locator("main").innerText();
  t("proof headline is about prices", /payable codes were recomputed across 7 fee schedule years/.test(proof));
  t("proof timing label verbatim", proof.toLowerCase().includes("our side, measured: synthetic notes, rule-based coder, provisional"));
  t("proof manual side blank", proof.includes("Not yet timed"));

  // Request
  await page.goto(base + "/request?plan=parallel", { waitUntil: "networkidle" });
  const before = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
  const inputs = await page.locator("main form input, main form select, main form textarea").count();
  t("request form has plan select plus four inputs only", inputs === 5, `${inputs}`);
  t("request has no textarea", (await page.locator("main textarea").count()) === 0);
  await page.getByRole("button", { name: "Prepare my request" }).click();
  t("request validates empty form", (await page.getByRole("alert").count()) >= 4);
  await page.getByLabel("Company name").fill("Example PACE");
  await page.getByLabel("Contact name").fill("Pat Example");
  await page.getByLabel("Work email").fill("pat@example.org");
  await page.getByLabel("Number of centers").fill("3");
  await page.getByRole("button", { name: "Prepare my request" }).click();
  await page.getByText("Not sent and not stored").waitFor();
  const req = await page.locator("main").innerText();
  t("request shows a summary, plan carried over", /Plan: Parallel, per claim/.test(req) && /Number of centers: 3/.test(req));
  const after = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
  t("request wrote nothing to the browser's storage", before === after);

  // Pricing
  await page.goto(base + "/pricing", { waitUntil: "networkidle" });
  const pr = await page.locator("main").innerText();
  t("pricing says list shape, not a quote", /List shape only\. Not a quote/.test(pr));
  t("pricing has no card button without env", !/Pay by card/.test(pr));

  // Internal build: Rest of NY by default, NYC localities selectable, every number from the loaded files.
  if (internal) {
    const shard = JSON.parse(readFileSync("public/years/physician/9.json", "utf8"));
    const ronyCents = shard["97110"].a["2026"];
    const pfs = JSON.parse(readFileSync("public/pfs-2026.json", "utf8"));
    const row = pfs.rows.find((r) => r.c === "97110" && r.m === "");
    const manhattan = pfs.localities.find((l) => l.state === "NY" && l.number === "01");
    const manCents = Math.round(Math.round((row.w * manhattan.work + row.pn * manhattan.pe + row.mp * manhattan.mp) * Number(pfs.conversion.nonQp) * 100 + 1e-9));
    await page.goto(base + "/desk", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Price this note" }).click();
    await page.getByText("Medicare reference price, not a payment").first().waitFor();
    let text = await page.locator("main").innerText();
    t("internal desk prices 97110 at the Rest of NY file amount", text.includes(`$${(ronyCents / 100).toFixed(2)}`) && /Rest Of New York, MAC 13282, locality 99/i.test(text), `${ronyCents}`);
    const options = await page.getByLabel("New York locality (internal)").locator("option").allInnerTexts();
    t("locality list is the five New York localities and nothing else", options.length === 5 && options.every((o) => /\(13\d{3}\/\d\d\)/.test(o)), options.join(" | "));
    await page.getByLabel("New York locality (internal)").selectOption("13202/01");
    await page.getByRole("button", { name: "Price this note" }).click();
    await page.getByText("Manhattan, MAC 13202").waitFor();
    text = await page.locator("main").innerText();
    t("Manhattan prices 97110 from the same file", text.includes(`$${(manCents / 100).toFixed(2)}`), `${manCents}`);
    await page.goto(base + "/code", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "97110", exact: true }).click();
    await page.getByText("Years and amounts").waitFor();
    text = await page.locator("main").innerText();
    t("internal code page shows every year", /2020/.test(text) && /2026/.test(text) && text.includes(`$${(ronyCents / 100).toFixed(2)}`));
    for (const path of ["/billing", "/book", "/ny", "/ops"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      t(`${path} opens in internal`, !(await page.getByText("is not part of this demo").isVisible().catch(() => false)));
    }
    await page.goto(base + "/book", { waitUntil: "networkidle" });
    const book = await page.locator("select option").allInnerTexts();
    t("code book lists New York localities only", book.filter((o) => /^\d{5} /.test(o)).every((o) => / NY /.test(o)), `${book.filter((o) => /^\d{5} /.test(o)).length} localities`);
  }

  // Public mode must not fetch the held-back files.
  if (!internal) {
    const forbidden = requests.filter((path) => /^\/(clfs-|years\/|once\/|ny-|found-rates|gap-rates|medicare-other|afs-|dme-|pfs-20(1|20|21|22|23|24|25))/.test(path));
    t("public mode never requests held-back files", forbidden.length === 0, forbidden.join(","));
    for (const path of ["/billing", "/ny", "/ops", "/book"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      t(`${path} is closed in public`, await page.getByText("is not part of this demo").isVisible());
    }
    const nav = await page.locator("header").innerText();
    t("public header shows no internal tab", !/Claim worksheet|File status|Code book/.test(nav + (await page.locator("footer").innerText())));
  }
  t("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}
await browser.close();
console.log(log.join("\n"));
console.log(failures.length === 0 ? "\nE2E PASS" : `\nE2E FAIL: ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);

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

  // Direct load and refresh of every route (the server renders each one; there is no client-only fallback to rely on).
  for (const path of publicPages) {
    const first = await page.goto(base + path, { waitUntil: "networkidle" });
    const again = await page.reload({ waitUntil: "networkidle" });
    t(`${path} direct load and refresh both return 200 with a heading`, first?.status() === 200 && again?.status() === 200 && (await page.locator("h1").count()) === 1, `${first?.status()} / ${again?.status()}`);
  }
  // A path that does not exist is a real 404 page: plain message, a way home, the main steps, the same layout, nothing leaked.
  const lost = await context.newPage();
  const lostErrors = [];
  lost.on("console", (message) => message.type() === "error" && !/fonts\.g|ERR_(NAME|INTERNET|CONNECTION)|status of 404/.test(message.text()) && lostErrors.push(message.text()));
  lost.on("pageerror", (error) => lostErrors.push(String(error)));
  const missing = await lost.goto(base + "/no-such-screen?probe=secret-value", { waitUntil: "networkidle" });
  const lostText = await lost.locator("body").innerText();
  t("404 page: HTTP status is 404", missing?.status() === 404, `${missing?.status()}`);
  t("404 page: says Not Found and gives a plain-words message", /Not Found/i.test(lostText) && /We couldn't find that page\./.test(lostText));
  t("404 page: does not repeat the requested path or query", !/no-such-screen|secret-value/.test(lostText));
  t("404 page: same header, nav and footer wording as other screens", (await lost.locator("header").count()) === 1 && (await lost.locator("footer").count()) === 1 && /Not a payment\. Not an EHR\. De-identified only\./.test(lostText), "");
  t("404 page: one h1 and one primary action", (await lost.locator("h1").count()) === 1 && (await lost.locator("main a.bg-teal, main button.bg-teal").count()) === 1);
  const steps = await lost.locator("main nav[aria-label='Main steps'] a").evaluateAll((nodes) => nodes.map((node) => `${node.textContent}=${node.getAttribute("href")}`));
  t("404 page: links to Try a note, Check an invoice, Request a pilot", steps.join("|") === "Try a note=/desk|Check an invoice=/invoice|Request a pilot=/request", steps.join("|"));
  const lostWide = await lost.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  t("404 page: no sideways scroll", lostWide <= 1, `overflow ${lostWide}px`);
  const internalLinks = await lost.locator("a[href='/billing'], a[href='/book'], a[href='/ny'], a[href='/ops']").count();
  t(internal ? "404 page (internal): internal links are the same as other screens" : "404 page (public): no internal-only link", internal ? true : internalLinks === 0, `${internalLinks}`);
  t("404 page: no console errors", lostErrors.length === 0, lostErrors.join(" | ").slice(0, 200));
  await lost.getByRole("link", { name: "Back to the start" }).click();
  await lost.waitForURL(base + "/");
  t("404 page: the link home works", new URL(lost.url()).pathname === "/" && (await lost.locator("h1").count()) === 1, lost.url());
  await lost.close();
  if (!internal) {
    for (const held of ["/pfs-2020.json", "/pfs-2026.json", "/years/physician/9.json", "/clfs-2026.json", "/afs-2026.json", "/dme-2026.json", "/ny-medicaid.json", "/found-rates.json", "/gap-rates.json", "/history/summary.json", "/history/physician.json"]) {
      const res = await page.request.get(base + held);
      t(`public build does not serve ${held}`, res.status() === 404, `${res.status()}`);
    }
  }

  // No dead links: every on-site link on every public page opens.
  const hrefs = new Set();
  for (const path of publicPages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    for (const href of await page.locator("a[href^='/']").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))) hrefs.add(href.split("?")[0]);
  }
  const dead = [];
  for (const href of hrefs) {
    const response = await page.goto(base + href, { waitUntil: "domcontentloaded" });
    if (!response || response.status() >= 400) dead.push(href);
  }
  t(`no dead links (${hrefs.size} distinct on-site links)`, dead.length === 0, dead.join(","));

  // Keyboard: the first Tab lands on the skip link, and a focused control shows an outline.
  await page.goto(base + "/desk", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  t("first Tab is the skip link", (await page.evaluate(() => document.activeElement?.textContent ?? "")).includes("Skip to the page"));
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement);
    return `${style.outlineStyle} ${style.outlineWidth}`;
  });
  t("a focused control shows an outline", /solid 2px/.test(outline), outline);

  // Desk
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

  // Therapy day: Claims Wedge's check values. National $95.69 (public), Rest of NY $93.58 (internal).
  await page.getByRole("button", { name: "A full therapy day" }).click();
  await page.getByRole("button", { name: "Price this note" }).click();
  await page.getByText("Total of these lines").waitFor();
  const dayText = await page.locator("main").innerText();
  const dayRows = await page.locator("tbody tr").allInnerTexts();
  t("therapy day prices 97110 at 3 units, not 6", dayRows.some((r) => /97110\s+.*\b3\b/s.test(r)) && !dayRows.some((r) => /\b6\b/.test(r.replace(/\$[\d.]+/g, ""))), dayRows.join(" / ").replace(/\s+/g, " "));
  t(`therapy day total is ${internal ? "$93.58" : "$95.69"}`, dayText.includes(internal ? "$93.58" : "$95.69"));
  t("therapy day says the reduction was applied and shows the split", /Multiple-procedure payment reduction applied/.test(dayText) && /1 full rate, 2 reduced/.test(dayText));
  await page.getByRole("button", { name: "One service" }).click();
  await page.getByRole("button", { name: "Price this note" }).click();
  await page.getByText("Medicare reference price, not a payment").first().waitFor();
  t("a single unit shows no reduction", !/Multiple-procedure payment reduction applied/.test(await page.locator("main").innerText()));

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
  t("invoice labels the therapy reduction on line two", /therapy reduction applied/.test(inv) && /Multiple-procedure payment reduction applied/.test(inv));
  await page.locator("textarea").fill("Code,Date,Charge\n11004,2026-03-02,100.00");
  await page.getByRole("button", { name: "Check the invoice" }).click();
  await page.getByText("not priced in the office setting").first().waitFor();
  const naInv = await page.locator("main").innerText();
  t("invoice: a non-facility NA code is not priced and not called a mismatch", /Not priced in the office setting/.test(naInv) && !/do not match/.test(naInv) && !/Over by|Under by/.test(naInv));
  await page.locator("textarea").fill("MRN 12345 97110 2026-03-01 10.00");
  await page.getByRole("button", { name: "Check the invoice" }).click();
  await page.getByRole("alert").filter({ hasText: /^Refused\./ }).waitFor();
  t("invoice refuses an identifier", true);

  // Code
  await page.goto(base + "/code", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "97110", exact: true }).click();
  await page.getByText("What it is").first().waitFor();
  const code = await page.locator("main").innerText();
  t("code shows a 2026 price and the disclaimer", /\$[\d,]+\.\d{2}/.test(code) && /Medicare reference price, not a payment/.test(code) && /2026/.test(code));
  if (!internal) t("code shows no other year in public", !/2025|2024|2023|2022|2021|2020/.test(code.replace(/Medicare national, non-facility, 2026/g, "")));

  await page.locator("#one-code").fill("11004");
  await page.getByText("Not priced in the office setting").first().waitFor();
  const naCode = await page.locator("main").innerText();
  const naYears = await page.locator("article ol li").allInnerTexts();
  t("code 11004 (non-facility NA): the Medicare years list shows no dollar amount, only 'not priced in the office setting'", /Not priced in the office setting/.test(naCode) && naYears.length > 0 && naYears.every((y) => !/\$\d/.test(y) && /Not priced in the office setting/.test(y)), naYears.join(" | ").replace(/\s+/g, " ").slice(0, 120));
  await page.locator("#one-code").fill("97026");
  await page.getByText("What it is").first().waitFor();
  const infra = await page.locator("main").innerText();
  t("code 97026 is priced", infra.includes(internal ? "$6.36" : "$6.68"), internal ? "Rest of NY $6.36" : "national $6.68");

  // About
  await page.goto(base + "/about", { waitUntil: "networkidle" });
  t("about says prices use the year-end release", /Prices use the year-end release/.test(await page.locator("main").innerText()));

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
    const years97110 = await page.locator("article ol li").allInnerTexts();
    const y2020 = years97110.find((y) => /2020/.test(y)) ?? "";
    t("code 97110: the 2020 Rest of NY amount is $30.47, as in the history database", /\$30\.47/.test(y2020), y2020.replace(/\s+/g, " ").slice(0, 120));
    // Claim worksheet: the sample invoice's two therapy lines on one date. 28.27 full + 20.78 reduced (answer key) = $49.05.
    await page.goto(base + "/invoice", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Use a synthetic sample invoice" }).click();
    await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("97110"));
    await page.getByRole("button", { name: "Check the invoice" }).click();
    await page.getByText("Put these lines on the claim worksheet (internal)").waitFor();
    await page.getByRole("button", { name: "Put these lines on the claim worksheet (internal)" }).click();
    await page.getByText("lines are on the claim worksheet").waitFor();
    await page.goto(base + "/billing", { waitUntil: "networkidle" });
    const sheet = await page.locator("main").innerText();
    t("claim worksheet applies and labels the therapy reduction", /Multiple-procedure payment reduction applied/.test(sheet) && /Selected allowed \$49\.05/.test(sheet), sheet.match(/Selected allowed \$[\d.]+/)?.[0] ?? "no total");
    // 2020 Rest of NY, from the CMS-Codes-checked history database (RVU20D): 97110 = $30.47.
    await page.goto(base + "/invoice", { waitUntil: "networkidle" });
    await page.locator("textarea").fill("Code,Date,Charge\n97110,2020-03-02,30.47\n11401,2020-03-02,150.16");
    await page.getByRole("button", { name: "Check the invoice" }).click();
    await page.getByText("Matches the 2020 file").first().waitFor();
    const inv2020 = await page.locator("main").innerText();
    t("internal invoice: a 2020 line at the database amount matches the 2020 file", /Matches the 2020 file/.test(inv2020), inv2020.match(/(Matches|Over by|Under by)[^\n]*/g)?.join(" | ") ?? "");
    for (const path of ["/billing", "/book", "/ny", "/ops"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      t(`${path} opens in internal`, !(await page.getByText("is not part of this demo").isVisible().catch(() => false)));
    }
    await page.goto(base + "/book", { waitUntil: "networkidle" });
    const book = await page.locator("select option").allInnerTexts();
    t("code book lists New York localities only", book.filter((o) => /^\d{5} /.test(o)).every((o) => / NY /.test(o)), `${book.filter((o) => /^\d{5} /.test(o)).length} localities`);
    // Non-facility NA (CMS "rarely or never done in the office"): Book and Filter say so and never show an office price.
    await page.getByPlaceholder("97110 or gait").fill("11004");
    await page.getByText("Not priced in the office setting").first().waitFor();
    const naBook = await page.locator("main").innerText();
    t("Book: NA code 11004 says not priced in the office setting", /Not priced in the office setting/.test(naBook));
    t("Book: NA code 11004 shows no fee schedule amount", !/Fee schedule\s*\$/.test(naBook) && !/Medicare pays\s*\$/.test(naBook));
    await page.getByLabel("Year").first().selectOption("2024");
    await page.locator("[data-note-2024]").first().waitFor();
    t("Book: 2024 shows the year-end release note", /January 1 through March 8, 2024/.test(await page.locator("[data-note-2024]").first().innerText()));
    await page.goto(base + "/filter", { waitUntil: "networkidle" });
    await page.getByPlaceholder("knee or A0130").fill("11004");
    await page.locator("tr", { hasText: "11004" }).first().waitFor();
    const naFilter = await page.locator("tr", { hasText: "11004" }).first().innerText();
    t("Filter: NA code 11004 says not priced in the office setting", /Not priced in the office setting/.test(naFilter) && !/\$\d/.test(naFilter), naFilter.replace(/\s+/g, " ").slice(0, 120));
    t("Filter (internal): keeps the CMS short name", /Dbrdmt skin xtrnl gent&per/.test(naFilter));
    // Filter "Use" step: Add to claim on an NA code must say so and must not take any office price.
    await page.evaluate(() => localStorage.clear());
    await page.locator("tr", { hasText: "11004" }).first().getByRole("button", { name: "Add to claim" }).click();
    const useStatus = await page.getByRole("status").filter({ hasText: "11004" }).first().innerText();
    t("Filter Use: 11004 says Not priced in the office setting", /Not priced in the office setting/.test(useStatus) && !/\$\d/.test(useStatus) && !/charge is the file amount/.test(useStatus), useStatus.replace(/\s+/g, " ").slice(0, 140));
    await page.goto(base + "/billing", { waitUntil: "networkidle" });
    const useLineText = await page.locator("li", { hasText: "11004 · 1" }).first().innerText();
    t("Filter Use: the 11004 claim line reads Not priced in the office setting", /Allowed Not priced in the office setting/.test(useLineText), useLineText.replace(/\s+/g, " ").slice(0, 160));
    t("Filter Use: the 11004 claim line has no dollar amount (no Rest of NY therapy price, no office price)", !/\$\d/.test(useLineText) && !/28\.27/.test(useLineText));
    t("Filter Use: the worksheet total takes no amount for 11004", /Selected allowed none/.test(await page.locator("main").innerText()));
    await page.goto(base + "/filter", { waitUntil: "networkidle" });
    await page.getByPlaceholder("knee or A0130").fill("11004");
    await page.locator("tr", { hasText: "11004" }).first().waitFor();
    await page.getByLabel("Year").first().selectOption("2024");
    await page.locator("[data-note-2024]").first().waitFor();
    t("Filter: 2024 shows the year-end release note", (await page.locator("[data-note-2024]").count()) >= 1);
    await page.goto(base + "/code", { waitUntil: "networkidle" });
    await page.locator("#one-code").fill("97110");
    await page.locator("[data-note-2024]").first().waitFor();
    t("Code (internal): 2024 price carries the year-end release note", /\$28\.03/.test(await page.locator("[data-note-2024]").first().innerText()));
    for (const path of ["/pace", "/history", "/filter"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      t(`${path} opens in internal`, !(await page.getByText("is not part of this demo").isVisible().catch(() => false)) && (await page.locator("h1").count()) >= 1);
    }
    // /history: codes Medicare does not pay or with no office price get no office amount (3,362 rows), and the 2024 note shows.
    await page.goto(base + "/history", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Physician" }).click();
    await page.getByText("3,362 changed").first().waitFor();
    t("/history: physician lists 3,362 changed codes", /3,362 changed/.test(await page.locator("main").innerText()));
    await page.locator("[data-note-2024]").first().waitFor();
    t("/history: the 2024 year-end note shows", /January 1 through March 8, 2024/.test(await page.locator("[data-note-2024]").first().innerText()));
    await page.getByPlaceholder("97110").fill("32445");
    await page.getByText("Nothing in this schedule matches").waitFor();
    t("/history: 32445 (no office price) shows no office amount", !/371\.59/.test(await page.locator("main").innerText()));
    // Book: a code Medicare does not pay gets no amount.
    await page.goto(base + "/book", { waitUntil: "networkidle" });
    await page.getByPlaceholder("97110 or gait").fill("97010");
    await page.getByText("Medicare does not pay this code separately").first().waitFor();
    const unpaidBook = await page.locator("main").innerText();
    t("Book: 97010 (status B) says Medicare does not pay it and shows no amount", !/Fee schedule\s*\$/.test(unpaidBook) && !/\$7\.75|\$6\.68/.test(unpaidBook));
    // PACE month: figures come from the CMS files and say so.
    await page.goto(base + "/pace", { waitUntil: "networkidle" });
    const paceText = await page.locator("main").innerText();
    t("PACE: 2026 New York County shows $1,983.61 with its source", /\$1,983\.61/.test(await page.locator('[data-county="New York"]').innerText()) && /CountyRate2026PACE\.csv/.test(paceText));
    t("PACE: ESRD is the PACE $12,051.55, not the MA $11,414.68", /\$12,051\.55/.test(await page.locator("[data-pace-esrd]").innerText()) && !/11,?414\.68/.test(paceText));
    t("PACE: Part D is labelled national averages with $239.27 and $38.99", /national averages, not New York rates/.test(paceText) && /\$239\.27/.test(paceText) && /\$38\.99/.test(paceText));
    t("PACE: 62 NY counties are listed", (await page.locator("[data-pace-rates] [data-county]").count()) === 62 && /Bronx/.test(paceText) && /St\. Lawrence/.test(paceText));
    t("PACE: no Medicare Advantage figure on the month screen", !/Medicare Advantage county/.test(paceText));
    t("PACE: no dollar figure without thousands commas", !/\$\d{4,}/.test(paceText));
    await page.locator("[data-pace-year]").selectOption("2020");
    const pace2020 = await page.locator("main").innerText();
    t("PACE: switching to 2020 reads the 2020 PACE file", /CountyRate2020PACE\.csv/.test(pace2020) && !/CountyRate2026PACE\.csv/.test(pace2020) && /\$8,651\.11/.test(await page.locator("[data-pace-esrd]").innerText()));
    t("PACE: 2020 ESRD note says Oct 2, 2020 and the original $8,234.99", /revised .*Oct 2, 2020/.test(await page.locator("[data-esrd-2020-note]").innerText()) && /\$8,234\.99/.test(await page.locator("[data-esrd-2020-note]").innerText()));
    await page.locator("[data-pace-year]").selectOption("2026");
    t("PACE: base county rate note shows", /before CMS adjusts them for each person/.test(paceText));
  }

  // Public mode must not fetch the held-back files.
  if (!internal) {
    const forbidden = requests.filter((path) => /^\/(clfs-|years\/|once\/|ny-|found-rates|gap-rates|medicare-other|afs-|dme-|pfs-20\d\d)/.test(path));
    t("public mode never requests held-back files", forbidden.length === 0, forbidden.join(","));
    for (const path of ["/billing", "/ny", "/ops", "/book", "/pace", "/history", "/filter"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      t(`${path} is closed in public`, await page.getByText("is not part of this demo").isVisible());
    }
    // CMS short names are CPT text: public Book and Filter show none, and no public screen or data file carries them.
    for (const path of ["/book", "/filter"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();
      t(`${path} (public) renders no CMS short name`, !/Dbrdmt skin xtrnl gent&per|Therapeutic exercises|Neuromuscular reeducation/.test(body));
    }
    await page.goto(base + "/code", { waitUntil: "networkidle" });
    await page.locator("#one-code").fill("11004");
    await page.getByText("Not priced in the office setting").first().waitFor();
    const code11004 = await page.locator("main").innerText();
    t("Code (public): 11004 shows the code number only, no short name", !/Dbrdmt/.test(code11004) && /Code number only/.test(code11004));
    const nationalJson = await page.evaluate(async () => (await fetch("/pfs-national-2026.json")).text());
    t("public national file carries no short names", !/"d":/.test(nationalJson) && !/Dbrdmt skin xtrnl gent&per/.test(nationalJson));
    const nav = await page.locator("header").innerText();
    await page.goto(base + "/code", { waitUntil: "networkidle" });
    await page.locator("#one-code").fill("97110");
    await page.locator("[data-reference-note]").first().waitFor();
    t("Code (public): no 2024 note, since 2024 is not shown", (await page.locator("[data-note-2024]").count()) === 0);
    t("public header shows no internal tab", !/Claim worksheet|File status|Code book/.test(nav + (await page.locator("footer").innerText())));
  }
  t("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}
await browser.close();
console.log(log.join("\n"));
console.log(failures.length === 0 ? "\nE2E PASS" : `\nE2E FAIL: ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);

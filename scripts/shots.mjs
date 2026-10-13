/** Saves full-page screenshots of the public screens at desktop and phone width. Usage: node scripts/shots.mjs <dir> */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const dir = process.argv[2] ?? "/workspace/shots";
for (const [label, vp] of [["d", { width: 1280, height: 900 }], ["m", { width: 375, height: 740 }]]) {
  const page = await (await b.newContext({ viewport: vp })).newPage();
  for (const path of ["/", "/desk", "/invoice", "/code", "/proof", "/about", "/pricing", "/request"]) {
    await page.goto("http://localhost:8080" + path, { waitUntil: "networkidle" });
    if (path === "/desk") { await page.getByRole("button", { name: "Price this note" }).click(); await page.waitForTimeout(300); }
    if (path === "/invoice") { await page.getByRole("button", { name: "Use a synthetic sample invoice" }).click(); await page.waitForTimeout(300); await page.getByRole("button", { name: "Check the invoice" }).click(); await page.waitForTimeout(500); }
    if (path === "/code") { await page.getByRole("button", { name: "97110", exact: true }).click(); await page.waitForTimeout(500); }
    if (path === "/proof") { await page.getByRole("button", { name: "Run the timing" }).click(); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${dir}/${label}${path === "/" ? "-home" : path.replace("/", "-")}.png`, fullPage: true });
  }
}
await b.close();

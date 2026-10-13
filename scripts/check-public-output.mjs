/**
 * Checks the production output that Vercel deploys (.vercel/output) after `npm run build` with VITE_DEMO_MODE unset (public).
 *   - the Build Output config sends every route to the server function (no client-only fallback needed);
 *   - static files hold no year shards, lab files, Medicaid, other-year or Rest of NY files;
 *   - the only price file is pfs-national-2026.json, with no localities;
 *   - no Rest of NY (or any NY locality) 2026 therapy amount appears in any built script;
 *   - no CMS short description (CPT text, AMA license) appears in any built file: public shows the code number only.
 * Usage: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/check-public-output.mjs [outputDir]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { INTERNAL_ONLY, NEVER_PUBLIC } from "../src/lib/config/mode.ts";
import { localityPrices } from "../src/lib/pricing/locality.ts";
import { THERAPY } from "../src/lib/desk/therapy-codes.ts";

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split("\\").join("/"));
  }
  return out;
}
const removable = (path) => NEVER_PUBLIC.some((rule) => rule.test(path)) || INTERNAL_ONLY.some((rule) => rule.test(path));

const root = process.argv[2] ?? ".vercel/output";
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
const last = config.routes.at(-1);
check("config.json: everything not a static file goes to the server function", last.src === "/(.*)" && last.dest === "/__server", JSON.stringify(last));
check("server function exists", existsSync(join(root, "functions/__server.func/index.mjs")) && existsSync(join(root, "functions/__server.func/.vc-config.json")));
check("static assets folder exists with scripts", walk(join(root, "static/assets")).some((p) => p.endsWith(".js")));

const files = walk(join(root, "static"));
check("no held-back file is in the static output", files.filter(removable).length === 0, files.filter(removable).join(", "));
check("no year shards, period shards or lab files", !files.some((p) => /^(years|once)\//.test(p) || /clfs|^afs|^dme|medicaid|^pfs-20(1|2[0-5])|found-rates|gap-rates|medicare-other|ny-more/.test(p)));
const data = files.filter((p) => p.endsWith(".json"));
check("the only price file is pfs-national-2026.json", data.filter((p) => p !== "proof.json").join() === "pfs-national-2026.json", data.join(", "));
const national = JSON.parse(readFileSync(join(root, "static/pfs-national-2026.json"), "utf8"));
check("national file has no localities and no facility or locality fields", !("localities" in national) && !national.rows.some((r) => "pf" in r || "tf" in r || "pe" in r || "gpci" in r), Object.keys(national).join(","));

// Rest of NY and the other four localities' 2026 therapy amounts, from the internal file. None may appear in built code.
const f2026 = JSON.parse(readFileSync("public/pfs-2026.json", "utf8"));
const amounts = new Set();
for (const key of ["13282/99", "13202/01", "13202/02", "13202/03", "13292/04"]) {
  const rates = localityPrices(f2026, key).rates;
  for (const item of THERAPY) if (rates[item.code]) amounts.add(rates[item.code].toFixed(2));
}
const scripts = [...walk(join(root, "static/assets")).map((p) => join(root, "static/assets", p)), ...walk(join(root, "functions")).filter((p) => /\.(mjs|js)$/.test(p)).map((p) => join(root, "functions", p))];
const leaks = [];
for (const path of scripts) {
  const text = readFileSync(path, "utf8");
  for (const amount of amounts) if (new RegExp(`(^|[^0-9.])${amount.replace(".", "\\.")}([^0-9]|$)`).test(text)) leaks.push(`${path.replace(root + "/", "")}: ${amount}`);
}
check(`no NY locality therapy amount (${amounts.size} distinct values, 5 localities) in ${scripts.length} built scripts`, leaks.length === 0, leaks.slice(0, 5).join("; "));
// CMS short descriptions are CPT text. None may ship in a public build: not in a data file, not in a script.
check("national file rows carry no short-name field", national.rows.every((r) => !("d" in r) && !("n" in r)));
const shortNames = new Set();
for (const row of f2026.rows) if (row.d && row.d.trim().length >= 8) shortNames.add(row.d.trim());
const builtFiles = [...files.map((p) => join(root, "static", p)), ...walk(join(root, "functions")).filter((p) => /\.(mjs|js|json)$/.test(p)).map((p) => join(root, "functions", p))].filter((p) => !/\.(jpg|png|svg|ico|woff2?)$/.test(p));
const nameLeaks = [];
for (const path of builtFiles) {
  const text = readFileSync(path, "utf8");
  for (const name of shortNames) if (text.includes(name)) nameLeaks.push(`${path.replace(root + "/", "")}: ${name}`);
}
check(`no CMS short description (${shortNames.size} names from the 2026 file) in ${builtFiles.length} built files`, nameLeaks.length === 0, `${nameLeaks.length} hits; ${nameLeaks.slice(0, 8).join("; ")}`);
check("the sample short name 'Dbrdmt skin xtrnl gent&per' is not in the build", !builtFiles.some((p) => readFileSync(p, "utf8").includes("Dbrdmt skin xtrnl gent&per")));
console.log(JSON.stringify({ staticFiles: files.length, failCount: failures.length }));
process.exit(failures.length === 0 ? 0 : 1);

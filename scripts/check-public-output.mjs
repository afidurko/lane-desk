/**
 * Checks the production output that Vercel deploys (.vercel/output) after `npm run build` with VITE_DEMO_MODE unset (public).
 *   - the Build Output config sends every route to the server function (no client-only fallback needed);
 *   - static files hold no year shards, lab files, Medicaid, other-year or Rest of NY files;
 *   - the only price file is pfs-national-2026.json, with no localities;
 *   - no Rest of NY (or any NY locality) 2026 therapy amount appears in any built script;
 *   - no CMS short description (CPT text, AMA license) appears in any built file: public shows the code number only;
 *   - Shield 12: no "Rest of New York", "13282" or "RVU24" anywhere in the built output (client or server), no
 *     near-descriptor note matcher, and proof.json is 2026 only.
 * Usage: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/check-public-output.mjs [outputDir]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { INTERNAL_ONLY, NEVER_PUBLIC } from "../src/lib/config/mode.ts";
import { localityPrices } from "../src/lib/pricing/locality.ts";
import { NEAR_DESCRIPTOR_PHRASES, THERAPY } from "../src/lib/desk/therapy-codes.ts";
import { descriptorHits, loadCmsDescriptors2026 } from "./cms-descriptors.mjs";

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
const isInstitutionOrNyCare = (path) => /(^|\/)(institution|ny-care)[^/]*/.test(path);
check("no institution* or ny-care* file in the static output", !files.some(isInstitutionOrNyCare), files.filter(isInstitutionOrNyCare).slice(0, 5).join(", "));
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
// Every CMS 2026 short descriptor (all releases of the 2026 RVU file on this machine), case-insensitive, in every
// built file, client and server. Skipped, and said so, when the RVU files are not on this machine.
const cms = loadCmsDescriptors2026();
if (!cms) {
  console.log("skip no CMS 2026 short descriptor in the build — the 2026 RVU files are not on this machine (set CMS_PFS_DIR)");
} else {
  const cmsHits = [];
  for (const path of builtFiles) for (const name of descriptorHits(readFileSync(path, "utf8"), cms.names)) cmsHits.push(`${path.replace(root + "/", "")}: ${name}`);
  check(`no CMS 2026 short descriptor (${cms.names.size} from ${cms.files.length} RVU files, case-insensitive) in ${builtFiles.length} built files`, cmsHits.length === 0, `${cmsHits.length} hits; ${cmsHits.slice(0, 10).join("; ")}`);
}
const paceMarks = ["CountyRate2026PACE", "198361", "1205155", "865111", "paceEsrdRevised", "Generated by scripts/build-pace-rates.py", "3,362 changed"];
const paceLeaks = builtFiles.filter((p) => { const text = readFileSync(p, "utf8"); return paceMarks.some((mark) => text.includes(mark)); });
check("no PACE ratebook data or /history data in the public build", paceLeaks.length === 0 && !files.some((p) => p.startsWith("history/")), paceLeaks.slice(0, 5).join(", "));
check("the sample short name 'Dbrdmt skin xtrnl gent&per' is not in the build", !builtFiles.some((p) => readFileSync(p, "utf8").includes("Dbrdmt skin xtrnl gent&per")));
// Shield 12: these strings regress loudly. Searched case-insensitively in every built text file, client and server.
const BANNED = ["Rest of New York", "13282", "RVU24"];
// Client files are checked as shipped. Server files are not minified, so source comments are stripped first
// (comments never run or render); every string and identifier in server code is still checked.
const codeOf = (p) => {
  const text = readFileSync(p, "utf8");
  return p.includes("/functions/") ? text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "") : text;
};
for (const word of BANNED) {
  const hits = builtFiles.filter((p) => codeOf(p).toLowerCase().includes(word.toLowerCase()));
  check(`no "${word}" in ${builtFiles.length} built files`, hits.length === 0, hits.slice(0, 5).map((p) => p.replace(root + "/", "")).join(", "));
}
const nearHits = [];
for (const path of builtFiles) {
  const text = readFileSync(path, "utf8").toLowerCase();
  for (const phrase of NEAR_DESCRIPTOR_PHRASES) if (text.includes(phrase)) nearHits.push(`${path.replace(root + "/", "")}: ${phrase}`);
}
check(`no near-descriptor phrase (${NEAR_DESCRIPTOR_PHRASES.length} phrases, anywhere in any text) in the build`, nearHits.length === 0, nearHits.slice(0, 5).join("; "));
const proofPath = join(root, "static/proof.json");
const proof = existsSync(proofPath) ? JSON.parse(readFileSync(proofPath, "utf8")) : null;
check("proof.json is 2026 only (no 2020-2025 rows, no other release)", proof !== null && proof.years.length === 1 && proof.years[0].year === 2026 && proof.totals.years === 1 && !/RVU2[0-5]/.test(JSON.stringify(proof)), proof ? proof.years.map((y) => `${y.year}/${y.release}`).join(",") : "missing");
console.log(JSON.stringify({ staticFiles: files.length, failCount: failures.length }));
process.exit(failures.length === 0 ? 0 : 1);

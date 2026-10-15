// Andrea co-sign fixes F2 (secret scan), F4 (internal builds), F5 (Node pin). Run by `npm test` (node --test scripts/**/*.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { buildModeDecision } from "./demo-mode-guard.mjs";

const read = (p) => readFileSync(p, "utf8");

test("F4: an unflagged internal production build is refused", () => {
  const d = buildModeDecision({ VITE_DEMO_MODE: "internal" });
  assert.equal(d.mode, null);
  assert.match(d.error, /LANE_INTERNAL_BUILD=1/);
});
test("F4: an internal build on Vercel is refused even with the flag", () => {
  for (const env of [{ VERCEL: "1" }, { VERCEL_ENV: "production" }, { VERCEL_ENV: "preview" }]) {
    const d = buildModeDecision({ ...env, VITE_DEMO_MODE: " Internal ", LANE_INTERNAL_BUILD: "1" });
    assert.equal(d.mode, null);
    assert.match(d.error, /Refusing an internal build on Vercel/);
  }
});
test("F4: flagged local internal build is allowed; anything else is public", () => {
  assert.deepEqual(buildModeDecision({ VITE_DEMO_MODE: "internal", LANE_INTERNAL_BUILD: "1" }), { mode: "internal", error: null });
  for (const v of [undefined, "", "public", "internl", "INTERNAL-ish"]) assert.equal(buildModeDecision({ VITE_DEMO_MODE: v, VERCEL_ENV: "production" }).mode, "public");
});
test("F4: vite.config runs the guard on build, and build:internal sets the flag", () => {
  assert.match(read("vite.config.ts"), /command === "build" && !isPreview[\s\S]*buildModeDecision\(process\.env\)[\s\S]*throw new Error/);
  assert.match(JSON.parse(read("package.json")).scripts["build:internal"], /LANE_INTERNAL_BUILD=1 VITE_DEMO_MODE=internal npm run build/);
});
test("F4: every internal-only route throws notFound() in a public build", () => {
  const routes = ["billing", "book", "compete", "filter", "history", "ny", "operate", "ops", "pace", "run", "team", "why"];
  for (const r of routes) assert.match(read(`src/routes/${r}.tsx`), /beforeLoad: publicNotFound,/, r);
  assert.match(read("src/components/gate.tsx"), /IS_INTERNAL\s*\?\s*undefined\s*:\s*\(\) => \{\s*throw notFound\(\);/);
});
test("F5: Node is pinned to >=22.12 in engines, .nvmrc and CI", () => {
  assert.equal(JSON.parse(read("package.json")).engines.node, ">=22.12.0 <23");
  assert.equal(read(".nvmrc").trim(), "22.12.0");
  for (const wf of ["self-check.yml", "fee-watch.yml"]) assert.match(read(`.github/workflows/${wf}`), /node-version-file: "\.nvmrc"/);
});
test("F2: gitleaks CI scans full history and the tree with a pinned, checksummed binary", () => {
  const wf = read(".github/workflows/gitleaks.yml");
  assert.match(wf, /fetch-depth: 0/);
  assert.match(wf, /GITLEAKS_VERSION: "8\.21\.2"/);
  assert.match(wf, /GITLEAKS_SHA256: "[0-9a-f]{64}"/);
  assert.match(wf, /sha256sum -c -/);
  assert.match(wf, /gitleaks git \. --redact[^\n]*--exit-code 1/);
  assert.match(wf, /gitleaks dir \. --redact[^\n]*--exit-code 1/);
});
test("F2: pre-commit hook scans staged changes, fails closed, and is installable", () => {
  const hook = read("scripts/hooks/pre-commit");
  assert.ok(statSync("scripts/hooks/pre-commit").mode & 0o111, "hook is executable");
  assert.match(hook, /git --pre-commit --staged --redact/);
  assert.match(hook, /exit 1/);
  assert.match(JSON.parse(read("package.json")).scripts["hooks:install"], /core\.hooksPath scripts\/hooks/);
});
test("F2: .gitleaksignore allows only the one historical finding, by fingerprint (no secret value)", () => {
  const lines = read(".gitleaksignore").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  assert.deepEqual(lines, ["4a180f7b399499ceed8f248732c41eec0555e37b:src/lib/auth/preview.ts:generic-api-key:20"]);
  assert.ok(existsSync(".github/workflows/gitleaks.yml"));
});

test("lockfile: CI workflows and Vercel install with npm ci, never npm install", () => {
  for (const wf of ["self-check.yml", "fee-watch.yml"]) {
    const text = read(`.github/workflows/${wf}`);
    assert.match(text, /- run: npm ci --no-audit --no-fund/, wf);
    assert.doesNotMatch(text, /npm install/, wf);
  }
  assert.equal(JSON.parse(read("vercel.json")).installCommand, "npm ci --no-audit --no-fund");
  assert.equal(JSON.parse(read("package-lock.json")).packages[""].engines?.node, ">=22.12.0 <23");
});
test("README and HANDOFF document npm ci and hooks:install", () => {
  assert.match(read("README.md"), /npm ci/);
  assert.match(read("README.md"), /npm run hooks:install/);
  assert.match(read("docs/HANDOFF.md"), /npm run hooks:install/);
});

import { descriptorHits, loadCmsDescriptors2026 } from "./cms-descriptors.mjs";
test("CMS descriptor matcher: case-insensitive, word-start, truncated long descriptors, no hits inside words", () => {
  const names = new Set(["whirlpool therapy", "assistive technology assess", "bls"]);
  assert.deepEqual(descriptorHits('phrases:["Whirlpool Therapy"]', names), ["whirlpool therapy"]);
  assert.deepEqual(descriptorHits("assistive technology assessment", names), ["assistive technology assess"]);
  assert.deepEqual(descriptorHits("tables and blsx and xwhirlpool therapy", names), []);
  assert.deepEqual(descriptorHits("ALS or BLS.", names), ["bls"]);
});
test("CMS descriptor loader: skips cleanly with no RVU files; reads codes, not the header", () => {
  assert.equal(loadCmsDescriptors2026("/nonexistent-cms-dir"), null);
  const real = loadCmsDescriptors2026();
  if (real) {
    assert.ok(real.names.size > 15000);
    assert.ok(real.names.has("whirlpool therapy"));
    assert.ok(!real.names.has("description"));
  }
});
test("therapy table: no matcher that ships in every build equals or starts a CMS 2026 short descriptor", () => {
  const real = loadCmsDescriptors2026();
  if (!real) return;
  const src = read("src/lib/desk/therapy-codes.ts");
  const shipped = [...src.matchAll(/phrases: (?:publicSafe\("\w+", )?(\[[^\]]*\])/g)].flatMap((m) => JSON.parse(m[1]));
  assert.ok(shipped.length > 50);
  assert.deepEqual(shipped.filter((p) => descriptorHits(p, real.names).length > 0), []);
});

test("public build prunes institution* and ny-care* data, and check:output fails on them", () => {
  const mode = readFileSync("src/lib/config/mode.ts", "utf8");
  const block = mode.slice(mode.indexOf("export const INTERNAL_ONLY"), mode.indexOf("];", mode.indexOf("export const INTERNAL_ONLY")));
  const rules = [...block.matchAll(/^\s*\/(.+)\/,/gm)].map((m) => new RegExp(m[1]));
  const pruned = (p) => rules.some((r) => r.test(p));
  for (const p of ["institution.json", "institution/index.json", "institution/hh-2026.json", "institution/hospice-2027.json", "institution/ipps-2020.json", "institution/irf-2025.json", "institution/snf-2024.json", "ny-care-2024.json"]) {
    assert.ok(pruned(p), `${p} must be internal-only`);
  }
  assert.ok(!pruned("pfs-national-2026.json") && !pruned("proof.json"));
  const check = readFileSync("scripts/check-public-output.mjs", "utf8");
  assert.match(check, /no institution\* or ny-care\* file in the static output/);
  const isBad = (path) => /(^|\/)(institution|ny-care)[^/]*/.test(path);
  assert.ok(isBad("institution.json") && isBad("institution/snf-2026.json") && isBad("ny-care-2024.json") && !isBad("pfs-national-2026.json"));
});

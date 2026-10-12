/**
 * Regression tests for the values Claims Wedge's independent price check found wrong, and their answer-key values.
 * National = what the public build shows. Rest of NY = internal build (13282/99). Both read the files on disk.
 * Run: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/price-regression.mjs
 */
import { readFileSync } from "node:fs";
import { indexNational, notOfficeOf, ratesOf } from "../src/lib/pricing/national.ts";
import { localityPrices } from "../src/lib/pricing/locality.ts";
import { fromFile, review } from "../src/lib/desk/clock.ts";

const failures = [];
let ran = 0;
const same = (name, got, want) => {
  ran += 1;
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const read = (name) => JSON.parse(readFileSync(name, "utf8"));
const national = indexNational(read("public/pfs-national-2026.json"));
const NAT = fromFile(ratesOf(national), { mppr: national.mppr, notOffice: notOfficeOf(national) });
const ny = localityPrices(read("public/pfs-2026.json"), "13282/99");
const NY = fromFile(ny.rates, { mppr: ny.mppr, notOffice: ny.notOffice });

const total = (lines) => Math.round(lines.reduce((sum, line) => sum + line.allowed, 0) * 100) / 100;
const run = (note, rates) => review(note, rates);

// ---- 1. Therapy multiple-procedure payment reduction (MPPR) ----
const SAMPLE_01 = "Therapeutic exercise, 45 minutes, 3 units.\nGait training, 15 minutes, 1 unit.";
same("sample-01 national is $95.69", total(run(SAMPLE_01, NAT).lines), 95.69);
same("sample-01 Rest of NY is $93.58", total(run(SAMPLE_01, NY).lines), 93.58);
const THREE = "Therapeutic exercise, 15 minutes.\nNeuromuscular re-education, 15 minutes.\nManual therapy, 15 minutes.";
same("97110+97112+97140 national is $76.15", total(run(THREE, NAT).lines), 76.15);
same("97110+97112+97140 Rest of NY is $74.40", total(run(THREE, NY).lines), 74.4);
same("97112 has the highest PE, so it is the full-rate unit", run(THREE, NAT).lines.map((l) => [l.code, l.mppr.fullUnits, l.mppr.reducedUnits]), [["97110", 0, 1], ["97112", 1, 0], ["97140", 0, 1]]);
same("one unit of one code is not reduced", run("Therapeutic exercise, 15 minutes.", NAT).lines.map((l) => [l.allowed, l.mppr.reducedUnits]), [[29.06, 0]]);
same("two units of one code: full + reduced", total(run("Gait training, 30 minutes.", NAT).lines), 51.27);
same("two units of one code Rest of NY", total(run("Gait training, 30 minutes.", NY).lines), 50.04);
same("answer-key sample-02 national", total(run("Neuromuscular re-education, 30 minutes.\nTherapeutic exercise, 30 minutes.", NAT).lines), 102.03);
same("answer-key sample-03 national", total(run("Therapeutic exercise, 30 minutes.\nManual therapy, 15 minutes.", NAT).lines), 72.48);
same("answer-key sample-03 Rest of NY", total(run("Therapeutic exercise, 30 minutes.\nManual therapy, 15 minutes.", NY).lines), 70.82);
same("MPPR table: 52 therapy codes in the file, payable ones have a reduced price", Object.keys(national.mppr).length > 40 && Object.values(national.mppr).every((m) => m.reducedCents < m.fullCents), true);

// ---- 2. A line that names a service and writes its code counts once ----
const DOUBLE = "Therapeutic exercise (97110), 45 minutes, 3 units.\nGait training (97116), 15 minutes, 1 unit.";
same("code + phrase on one line: 3 units and 1 unit, not 6 and 2", run(DOUBLE, NAT).lines.map((l) => [l.code, l.units]), [["97110", 3], ["97116", 1]]);
same("code + phrase: national total is the sample-01 value", total(run(DOUBLE, NAT).lines), 95.69);
same("code + phrase: Rest of NY total is the sample-01 value", total(run(DOUBLE, NY).lines), 93.58);
same("the exact line from the report prices 3 units", run("Therapeutic exercise (97110), 45 minutes, 3 units.", NAT).lines.map((l) => [l.code, l.units]), [["97110", 3]]);
same("code only, no phrase: still 3 units", run("97110, 45 minutes, 3 units.", NAT).lines.map((l) => [l.code, l.units]), [["97110", 3]]);
same("two separate lines of one service still add", run("Therapeutic exercise, 15 minutes.\nTherapeutic exercise, 15 minutes.", NAT).lines.map((l) => [l.code, l.units]), [["97110", 2]]);
same("two identical lines (same words) still add", run("Gait training, 1 unit.\nGait training, 1 unit.", NAT).lines.map((l) => [l.code, l.units]), [["97116", 2]]);

// ---- 4. 97026 is paid ----
import { allowedOf } from "../src/lib/desk/clock.ts";
import { THERAPY } from "../src/lib/desk/therapy-codes.ts";
same("97026 national $6.68 on the desk", total(run("Infrared therapy, one unit.", NAT).lines), 6.68);
same("97026 Rest of NY $6.36 on the desk", total(run("Infrared therapy, one unit.", NY).lines), 6.36);
same("97026 typed table is $6.36 and separate", THERAPY.find((t) => t.code === "97026") && [THERAPY.find((t) => t.code === "97026").separate, THERAPY.find((t) => t.code === "97026").unitDollars], [true, 6.36]);
same("97026 typed fallback prices a unit at $6.36", allowedOf(1, "97026"), 6.36);
same("a bundled code (97010) is still $0 from the file", [allowedOf(1, "97010", NAT), allowedOf(1, "97010", NY)], [0, 0]);
same("97545 (status R, no amount) is still $0", [allowedOf(1, "97545", NAT), allowedOf(1, "97545", NY)], [0, 0]);
same("every typed therapy amount equals the file's Rest of NY amount", THERAPY.filter((t) => t.separate && Math.abs(t.unitDollars - (ny.rates[t.code] ?? 0)) > 0.0001).map((t) => t.code), []);

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

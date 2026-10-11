import { review, gate, unitsOf, allowedOf, spanOf, SAMPLE_NOTE, CODE } from "../src/lib/desk/clock.ts";
import { sealRow, readRows, writeRows } from "../src/lib/desk/store.ts";
import { screen } from "../src/lib/security/mesh.ts";
import { contain } from "../src/lib/security/patch-net.ts";
import { briefFromRows, incumbentIntel, runLane } from "../src/lib/desk/lane.ts";
import { dollarsFromTotal, sequester, sequestrationPercent } from "../src/lib/book/price.ts";
import { admit, filterRows, rowsOf } from "../src/lib/book/book.ts";

const failures = [];
let ran = 0;

function check(name, ok) {
  ran += 1;
  if (!ok) failures.push(name);
}

const sample = review(SAMPLE_NOTE);
check("sample ok", sample.gate === "ok" && sample.units === 1 && sample.patches.length === 0);
check("sample price", sample.units !== null && allowedOf(sample.units) === 28.27);
check("sample span", spanOf(SAMPLE_NOTE).includes("Therapeutic exercise"));
check("sample code path", gate(SAMPLE_NOTE) === "ok");

check("double space", gate("Therapeutic  exercise, supervised, 15 minutes.") === "ok");
check("split words", gate("therapeutic\nexercise for 15 minutes") === "ok");
check("split span", spanOf("therapeutic\nexercise for 15 minutes") === "therapeutic exercise");

check("nine units", review("therapeutic exercise, 9 units").gate === "units");
check("zero units", review("therapeutic exercise, zero units").gate === "units");
check("135 minutes", review("therapeutic exercise, 135 minutes").gate === "units");
check("two units", unitsOf("therapeutic exercise, two units") === 2);
check("30 minutes", unitsOf("therapeutic exercise, 30 minutes") === 2);
check("eight word", unitsOf("therapeutic exercise, eight units") === 8);
check("no count defaults", unitsOf("therapeutic exercise only") === 1);

const nested = review(`${SAMPLE_NOTE}\n<scr<script>ipt>alert(1)</script>`);
check("nested script gone", nested.gate === "ok" && !/<\s*script/i.test(nested.text) && !nested.text.includes("<scr"));
check("nested patched", nested.patches.some((item) => item.includes("script")));

const brokenUrl = review(`${SAMPLE_NOTE}\njava\nscript:alert(1)`);
check("split javascript", brokenUrl.gate === "ok" && !/java\s*script\s*:/i.test(brokenUrl.text));

const handler = review(`${SAMPLE_NOTE}\n<img src=x onerror=alert(1)>`);
check("handler gone", handler.gate === "ok" && !/onerror\s*=/i.test(handler.text) && !handler.text.includes("<img"));

check("phi", gate("MRN 100. Therapeutic exercise, 15 minutes.") === "phi");
check("ssn", gate("Therapeutic exercise 123-45-6789") === "phi");
check("phone", gate("Therapeutic exercise. Call 585-555-0199.") === "phi");
check("empty", gate("   ") === "empty");
check("wrong type", gate("Office visit, 99214, established patient.") === "wrong-type");
check("oversize", gate(`${"therapeutic exercise ".repeat(2000)}`) === "oversize");
check("97110 alone", gate("Code 97110, one unit.") === "ok");
check("97112 price", review("Neuromuscular reeducation, 15 minutes.").lines[0]?.allowed === 31.85);
check("97116 price", review("Gait training, 30 minutes.").lines[0]?.code === "97116" && review("Gait training, 30 minutes.").lines[0]?.allowed === 56.54);
check("97140 price", review("Manual therapy, one unit.").lines[0]?.allowed === 26.97);
check("97530 price", review("Therapeutic activities, 15 minutes.").lines[0]?.allowed === 33.97);
check("97535 price", review("Self-care training, one unit.").lines[0]?.allowed === 31.45);
check("gait alone is not gait training", review(SAMPLE_NOTE).lines.length === 1 && review(SAMPLE_NOTE).lines[0].code === "97110");

const two = review("Therapeutic exercise, 15 minutes.\nManual therapy, 15 minutes.");
check(
  "two codes",
  two.gate === "ok" &&
    two.lines.length === 2 &&
    two.lines[0].code === "97110" &&
    two.lines[1].code === "97140" &&
    Math.round((two.lines[0].allowed + two.lines[1].allowed) * 100) / 100 === 55.24,
);
check("same line splits", review("Therapeutic exercise and manual therapy, 15 minutes.").gate === "split");
check("waiver code stops", gate("Therapeutic exercise, 15 minutes. S5100.") === "wrong-type");
check("eval code stops", gate("97161 low complexity evaluation.") === "wrong-type");

const sealedOther = sealRow({
  id: "row-97140",
  at: "2026-10-10T12:00:00.000Z",
  span: "Manual therapy, one unit.",
  code: "97140",
  units: 2,
  allowed: 1,
  scriptSeconds: null,
  humanSeconds: null,
});
check("other code reseals", sealedOther !== null && sealedOther.allowed === 53.94 && sealedOther.name === "Manual therapy");

const lane = runLane(SAMPLE_NOTE, null, 2.3);
check("lane order", lane.layers.map((layer) => layer.id).join(",") === "gate,claims,intel,proof,kai");
check("teams on a price", lane.teams.map((team) => team.name).join(",") === "Shield,Claims Wedge,CMS Codes,Incumbent Intel,Center Hunt,Handoff,Takeover,Kai");
check("scan stays off a claim", lane.teams.find((team) => team.name === "Center Hunt")?.status === "did-not-run");
check("capability refuses", runLane("Office visit, 99214.", null, null).teams.find((team) => team.name === "Claims Wedge")?.status === "stop");
check("phi skips teams", runLane("MRN 100. Therapeutic exercise.", null, null).teams.every((team) => team.status === "did-not-run"));
check("untimed hold", lane.layers[3].status === "hold" && lane.ship === false && lane.brief?.decision.startsWith("Hold") && lane.proof.status === "hold");
check("boundary blocks a scrape", runLane("Therapeutic exercise, 15 minutes. Scrape the portal.", null, null).boundary?.includes("does not scrape") === true);
check("intel has no note", incumbentIntel.length === 0 && !incumbentIntel().detail.includes("Participant"));
check("boundary blocks a claim", runLane("Submit the 837 claim.", null, null).boundary?.includes("does not submit") === true);
const contained = contain("<script>alert(1)</script> Therapeutic exercise, 15 minutes.");
check("markup is removed and not kept as a payload", contained.decision === "clear" && !contained.text.includes("script") && contained.actions.some((action) => action.team === "Shield"));
const dropped = contain("SSN 123-45-6789 therapeutic exercise");
check("identifier is dropped before use", dropped.decision === "stop" && dropped.text === "" && dropped.kept === false && dropped.actions.some((action) => action.team === "Shield"));
check("boundary blocks an hpi", runLane("Write the HPI for this visit.", null, null).lines.length === 0);
check("an hpi heading can still be priced", runLane("History of present illness. Therapeutic exercise, 15 minutes.", null, null).lines.length === 1);
check("phi text is dropped", runLane("MRN 100. Therapeutic exercise.", null, null).text === "");
check("off schedule stops claims", runLane("Office visit, 99214.", null, null).layers[1].status === "stop");
const timed = runLane(SAMPLE_NOTE, 40, 2.3);
check("timed ships", timed.ship === true && timed.brief?.measuredDelta.startsWith("37.7"));
check("proof passes a timed row", timed.proof.status === "pass" && timed.proof.nextProof.includes("same encounter"));
check("kept brief", briefFromRows(sealedOther ? [sealedOther] : [])?.proofPath.includes("97140"));

check("book national 97110", dollarsFromTotal(0.87, "33.4009") === 29.06);
check("book sequester", sequester(50).paid === 39.2 && sequester(50).cut === 0.8 && sequester(50).coinsurance === 10);
check("sequester paused", sequestrationPercent("2021-06-01") === 0 && sequestrationPercent("2022-05-01") === 1 && sequestrationPercent("2020-04-01") === 2 && sequestrationPercent("2024-01-01") === 2);
check("book filters year", filterRows(rowsOf([]), "2025", "all", "").length === 0);
const missing = admit({ code: "97110", name: "Therapeutic exercise", year: "2026", scheduleId: "mpfs-2026-nf", amount: "10", source: "A made up rate sheet", added: [] });
check("book refuses a rewrite", missing.ok === false);
const added = admit({ code: "T1019", name: "Personal care", year: "2026", scheduleId: "waiver", amount: "4.25", source: "State waiver fee schedule, section 4", added: [] });
check("book accepts a sourced row", added.ok === true && added.ok && added.row.unitDollars === 4.25);

const longLine = `Therapeutic exercise, ${"supervised balance work ".repeat(20)}15 minutes. One unit.`;
check("long line still a note", longLine.length > 200 && longLine.length < 8000);
const sealedLong = sealRow({
  id: "abc12345-def",
  at: "2026-10-10T12:00:00.000Z",
  span: longLine,
  code: CODE,
  units: 1,
  allowed: 1,
  scriptSeconds: 2.34,
  humanSeconds: 40,
});
check("long span kept", sealedLong !== null && sealedLong.allowed === 28.27 && sealedLong.span.includes("Therapeutic exercise"));

check(
  "price reseal",
  sealRow({
    id: "row-00001",
    at: "2026-10-10T12:00:00.000Z",
    span: "Therapeutic exercise, one unit.",
    code: "97110",
    units: 1,
    allowed: 999,
    scriptSeconds: 2,
    humanSeconds: null,
  })?.allowed === 28.27,
);
check(
  "bad code dropped",
  sealRow({
    id: "row-00002",
    at: "2026-10-10T12:00:00.000Z",
    span: "Therapeutic exercise",
    code: "99214",
    units: 1,
    allowed: 29.06,
    scriptSeconds: null,
    humanSeconds: null,
  }) === null,
);
check(
  "nine stored units dropped",
  sealRow({
    id: "row-00003",
    at: "2026-10-10T12:00:00.000Z",
    span: "Therapeutic exercise",
    code: "97110",
    units: 9,
    allowed: 261.54,
    scriptSeconds: null,
    humanSeconds: null,
  }) === null,
);
check(
  "bad id dropped",
  sealRow({
    id: "<script>",
    at: "2026-10-10T12:00:00.000Z",
    span: "Therapeutic exercise",
    code: "97110",
    units: 1,
    allowed: 29.06,
    scriptSeconds: null,
    humanSeconds: null,
  }) === null,
);

const mail = screen("person@example.com", "email");
check("email", mail.stop === null && mail.text === "person@example.com");
const dirtyMail = screen("  person@example.com<script>  ", "email");
check("email scrub", dirtyMail.stop === null && dirtyMail.text === "person@example.com");
check("bad email", screen("not an email", "email").stop === "bad-email");
check("long email", screen(`${"a".repeat(250)}@example.com`, "email").stop === "oversize");

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
const kept = sealRow({
  id: "row-00004",
  at: "2026-10-10T12:00:00.000Z",
  span: "Therapeutic exercise, one unit.",
  code: "97110",
  units: 1,
  allowed: 29.06,
  scriptSeconds: 2.3,
  humanSeconds: 11,
});
writeRows(kept ? [kept] : []);
check("round trip", readRows().length === 1 && readRows()[0].allowed === 28.27 && readRows()[0].humanSeconds === 11);
memory.set(
  "lane-desk-rows",
  JSON.stringify([{ ...kept, allowed: 999, code: "97110" }]),
);
check("reload reseals price", readRows()[0].allowed === 28.27);
memory.set("lane-desk-rows", JSON.stringify([{ ...kept, code: "99214" }]));
check("reload drops bad code", readRows().length === 0);
writeRows(Array.from({ length: 250 }, (_, index) => ({ ...kept, id: `row-${String(index).padStart(5, "0")}` })));
check("cap 200", readRows().length === 200);

const stable = screen(SAMPLE_NOTE, "note");
const again = screen(stable.text, "note");
check("idempotent", again.text === stable.text && again.patches.length === 0 && again.stop === null);

const nasty = `${"a".repeat(2000)}@${"a.".repeat(1500)}aa`;
const started = Date.now();
screen(nasty.slice(0, 7000), "note");
check("phi regex finishes", Date.now() - started < 1000);

const alphabet = "abcdefghijklmnopqrstuvwxyz <>/:'=@.019 \n\t";
for (let i = 0; i < 20000; i += 1) {
  let text = i % 17 === 0 ? "Therapeutic exercise, one unit. " : "";
  const len = (i * 17) % 240;
  for (let n = 0; n < len; n += 1) text += alphabet[(i * 13 + n * 7) % alphabet.length];
  if (i % 5 === 0) text += "<scr<script>ipt>alert(1)</script>";
  if (i % 7 === 0) text += " java\nscript:alert(1)";
  if (i % 11 === 0) text += " onerror=alert(1)";
  let result;
  try {
    result = i % 2 === 0 ? screen(text, "note") : review(text);
  } catch (error) {
    failures.push(`throw ${i} ${error}`);
    break;
  }
  const body = "text" in result ? result.text : "";
  ran += 1;
  if (/<\s*\/?\s*script/i.test(body) || /java\s*script\s*:/i.test(body) || /onerror\s*=/i.test(body)) {
    failures.push(`residue ${i}`);
    break;
  }
}

console.log(JSON.stringify({ ran, failures: failures.slice(0, 12), failCount: failures.length }));
if (failures.length > 0) process.exit(1);

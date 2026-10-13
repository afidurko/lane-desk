import { quoteCode } from "../src/lib/billing/billing.ts";
import { readFileSync } from "node:fs";
import { describeCode } from "../src/lib/lookup/describe.ts";
import { canEnroll, blockedText, monthLine, missingSeats, SEATS } from "../src/lib/pace/gates.ts";
import { medicareCents } from "../src/lib/pace/rates.ts";
import { dailyBridge, placeOnSheet } from "../src/lib/team/bridge.ts";
import { rankBrief, rankInvoice, rankMemory } from "../src/lib/team/rank.ts";
import { previousUse, reasonLine, reasonMonth } from "../src/lib/lookup/reason.ts";
import { readInvoiceLines, payBucket, paymentAlert, auditReport } from "../src/lib/lookup/check.ts";
import { associate } from "../src/lib/lookup/associate.ts";
import { pickOnce } from "../src/lib/lookup/once.ts";
import { parseInvoice, claimsFromInvoice } from "../src/lib/billing/invoice.ts";
import { buildPacket, nextGap, packetJson } from "../src/lib/billing/packet.ts";
import { submitterReady } from "../src/lib/billing/submitter.ts";
import { checkLine, claimAlerts } from "../src/lib/billing/verify.ts";
import { claimGuards } from "../src/lib/billing/guard.ts";
import { safeFixes } from "../src/lib/help/routines.ts";

const books = { physician: null, ambulance: null, lab: null, dme: null };
const failures = [];
let ran = 0;

function check(name, ok) {
  ran += 1;
  if (!ok) failures.push(name);
}

const invoice = parseInvoice("Entity: Olean General\n97110 Therapeutic exercise 2026-07-01 28.27\nEntity: Rural transport\nA0428 Ambulance 2026-07-01 250.00", books, "2026-07-01");
check("two entities", invoice.entities.length === 2);
check("two lines", invoice.lines.length === 2);
check("unmatched is high alert", invoice.lines.every((line) => line.alert?.level === "high"));

const claims = claimsFromInvoice(invoice, "org-1");
check("one claim per entity", claims.length === 2);
check("entity on the note", claims[0].lines[0].note.startsWith("Olean General"));

const submitter = { name: "Lane desk", npi: "1234567893", submitterId: "NGS-1", receiver: "MAC 13282" };
check("submitter ready", submitterReady(submitter));
check("blank submitter not ready", !submitterReady({ name: "", npi: "", submitterId: "", receiver: "" }));

const claim = {
  id: "c1",
  clientId: "org-1",
  dos: "2026-07-01",
  pos: "12",
  diagnosis: "M25.561",
  number: "OLN-1001",
  note: "",
  payer: "medicare",
  status: "draft",
  lines: [{ id: "l1", code: "97110", modifier: "GP", units: 1, chargeCents: 2827, allowedCents: 2827, schedule: "Physician", note: "exercise" }],
};
const client = { id: "org-1", name: "Olean General", npi: "1234567893" };
const bare = { ...claim, lines: [{ ...claim.lines[0], modifier: "" }] };
check("therapy without a modifier is blocked", !buildPacket(bare, client, submitter).ready);
check("two disciplines are blocked", claimGuards({ ...claim, lines: [...claim.lines, { ...claim.lines[0], id: "l2", modifier: "GO" }] }, null).some((item) => item.reason.includes("disciplines")));
check("ambulance place is blocked", claimGuards({ ...claim, pos: "11", lines: [{ ...claim.lines[0], code: "A0428", modifier: "" }] }, null).some((item) => item.reason.includes("place of service 41")));
check("old date is blocked", claimGuards({ ...claim, dos: "2024-01-01" }, null, "2026-10-11").some((item) => item.reason.includes("12 months")));
check("wrong file year is blocked", claimGuards(claim, { physician: { year: 2025 }, ambulance: null, lab: null, dme: null }, "").some((item) => item.reason.includes("2026")));
check("nine therapy units are blocked", claimGuards({ ...claim, lines: [{ ...claim.lines[0], units: 9 }] }, null).some((item) => item.reason.includes("1 to 8")));
check("mileage is not capped at 8", !claimGuards({ ...claim, pos: "41", lines: [{ ...claim.lines[0], code: "A0425", modifier: "", units: 18 }] }, null).some((item) => item.reason.includes("Units")));
const downloaded = JSON.parse(packetJson({ ...claim, dos: "2025-07-01" }, client, submitter, { physician: { year: 2026 }, ambulance: null, lab: null, dme: null }, "2026-10-11"));
check("downloaded packet keeps the year stop", downloaded.ready === false && downloaded.missing.some((item) => item.includes("2025")));
const shaved = claimAlerts(claim, { physician: null, ambulance: null, lab: null, dme: null }).length;
check("alerts include the therapy line", shaved >= 1);
const packet = buildPacket(claim, client, submitter);
check("packet ready", packet.ready && packet.form === "837P" && packet.fields.submitterId === "NGS-1" && packet.cms1500.box26 === "OLN-1001");
const noNumber = buildPacket({ ...claim, number: "" }, client, submitter);
check("packet waits for claim number", !noNumber.ready && noNumber.missing.some((item) => item.includes("Claim number")));
const missing = buildPacket(claim, client, null);
check("packet waits for submitter", !missing.ready && missing.missing.some((item) => item.includes("submitter")));
const noDx = buildPacket({ ...claim, diagnosis: "" }, client, submitter);
check("packet waits for diagnosis", !noDx.ready && noDx.missing.some((item) => item.includes("Diagnosis")));
check("next is the organization", nextGap(null, null, null, 0).title === "Add the organization");
check("next is the alert", nextGap(claim, client, submitter, 1).title === "Clear the high alert");
check("next is the download", nextGap(claim, client, submitter, 0).title === "Download the packet");

const clear = checkLine(claim.lines[0], books);
check("unloaded code is high", clear.level === "high");
const amb = safeFixes({ ...claim, pos: "11", lines: [{ ...claim.lines[0], code: "A0428", modifier: "", chargeCents: 100 }] }, books);
check("ambulance place is set by the routine", amb.claim.pos === "41" && amb.claim.lines[0].chargeCents === 100);
const left = safeFixes(bare, books);
check("a blank modifier is not guessed", left.claim.lines[0].modifier === "" && left.claim.pos === "12");
check("a ready claim is not rewritten", safeFixes({ ...claim, status: "ready" }, books).changed === 0);
check("a PLA code is a real code shape", quoteCode(books, "0001U", "").schedule !== "none");
const pasted = readInvoiceLines("97110 2026-03-01 28.27\nA0428 6/12/2025 277.09\npatient walked the hall");
check("an invoice keeps the code, year, and amount", pasted.length === 2 && pasted[0].year === 2026 && pasted[0].billedCents === 2827 && pasted[1].year === 2025);
check("words that are not a code are ignored", pasted.every((line) => line.code === "97110" || line.code === "A0428"));
const told = describeCode("Physician", { n: "Therapeutic exercises", s: "A", a: { "2020": 3047, "2026": 2827 } });
check("a code description names the file wording and both years", told.includes("Therapeutic exercises") && told.includes("$28.27") && told.includes("$30.47") && told.includes("down"));
const sheet = readInvoiceLines("CPT,DOS,Charge\n97110,2026-03-01,30.00");
check("a spreadsheet header is not a line", sheet.length === 1 && sheet[0].code === "97110" && sheet[0].billedCents === 3000 && sheet[0].year === 2026);
const columns = readInvoiceLines("Code,Date,Allowed,Charge\n97110,3/1/2026,28.27,\"$30.00\"");
check("the charge column is the billed amount, not the allowed column", columns.length === 1 && columns[0].billedCents === 3000 && columns[0].year === 2026);
check("a matching charge is in the match group, and a missing year needs a person", payBucket({ year: 2026, billedCents: 2827 }, 2827) === "match" && payBucket({ year: null, billedCents: 2827 }, 2827) === "look" && payBucket({ year: 2026, billedCents: 3000 }, 2827) === "off");
const mismatch = paymentAlert({ code: "97110", year: 2026, billedCents: 3000, fileCents: 2827 });
const unknown = paymentAlert({ code: "97160", year: 2026, billedCents: 5000, fileCents: null });
check("a mismatch names both amounts and an unknown code invents nothing", mismatch.kind === "off" && mismatch.reason.includes("$28.27") && mismatch.reason.includes("$30.00") && unknown.kind === "look" && !unknown.reason.includes("$"));
check("a 2026 line can use a file from that year", pickOnce([{ s: "Part B drug", t: "October 2026", c: 13823, n: "Hep" }], 2026)?.c === 13823);
check("a 2024 line does not use a 2026-only file", pickOnce([{ s: "Part B drug", t: "October 2026", c: 13823, n: "Hep" }], 2024) === null);
check("March does not use an October file", pickOnce([{ s: "Part B drug", t: "October 2026", c: 13823, n: "Hep" }, { s: "Part B drug", t: "January 2026", c: 100, n: "Hep" }], 2026, 3)?.c === 100);
check("an October-only file is not used for March", pickOnce([{ s: "Part B drug", t: "October 2026", c: 13823, n: "Hep" }], 2026, 3) === null);
const two = readInvoiceLines("97110 2026-03-01 28.27 30.00");
const paid = readInvoiceLines("Code,Date,Paid\n97110,2026-03-01,28.27");
const units = readInvoiceLines("97110 2 units 2026-03-01 56.54");
check("two amounts are not assigned", two[0].ambiguous && two[0].billedCents === null);
check("a paid column is not the charge", paid[0].chargeKnown === false && paid[0].billedCents === null && paid[0].paidCents === 2827 && paid[0].paidKind === "paid");
const allowed = readInvoiceLines("Code,Date,Allowed,Charge\n97110,3/1/2026,28.27,\"$30.00\"");
check("an allowed column stays beside the charge", allowed[0].billedCents === 3000 && allowed[0].paidCents === 2827 && allowed[0].paidKind === "allowed");
const overpaid = auditReport({ code: "97110", year: 2026, billedCents: null, paidCents: 3000, paidKind: "paid", fileCents: 2827, units: 1, block: null });
const underpaid = auditReport({ code: "97110", year: 2026, billedCents: null, paidCents: 2000, paidKind: "paid", fileCents: 2827, units: 1, block: null });
const paidMatch = auditReport({ code: "97110", year: 2026, billedCents: null, paidCents: 2827, paidKind: "paid", fileCents: 2827, units: 1, block: null });
const paidUnknown = auditReport({ code: "97160", year: 2026, billedCents: null, paidCents: 5000, paidKind: "paid", fileCents: null, units: 1, block: null });
check("an administrator payment over the file names both amounts", overpaid.kind === "off" && overpaid.side === "over" && overpaid.reasons[0].includes("$30.00") && overpaid.reasons[0].includes("$28.27") && overpaid.reasons[0].includes("over"));
check("an administrator payment under the file is under", underpaid.side === "under" && underpaid.reasons[0].includes("under") && underpaid.reasons[0].includes("$20.00"));
check("an administrator payment on the file matches", paidMatch.kind === "match" && paidMatch.reasons.some((line) => line.includes("not checked")));
check("an unknown paid code invents nothing", paidUnknown.kind === "look" && !paidUnknown.reasons.join(" ").includes("$"));
check("units are read and scale the comparison", units[0].units === 2 && payBucket(units[0], 2827) === "match");
const office = associate({ code: "97110", modifier: "", year: 2026, setting: null, payer: null, ambiguous: false, chargeKnown: true, hits: [{ family: "physician", label: "Physician", row: { a: { "2026": 2827 } } }], once: null });
const both = associate({ code: "97110", modifier: "", year: 2026, setting: "nf", payer: null, ambiguous: false, chargeKnown: true, hits: [{ family: "physician", label: "Physician", row: { a: { "2026": 2827 } } }, { family: "lab", label: "Lab", row: { a: { "2026": 700 } } }], once: null });
const ride = associate({ code: "A0428", modifier: "", year: 2026, setting: null, payer: null, ambiguous: false, chargeKnown: true, hits: [{ family: "physician", label: "Physician", row: { a: { "2026": 100 } } }, { family: "ambulance", label: "Ambulance", row: { a: { "2026": 27709 } } }], once: null });
const part = associate({ code: "97110", modifier: "26", year: 2026, setting: "nf", payer: null, ambiguous: false, chargeKnown: true, hits: [{ family: "physician", label: "Physician", row: { a: { "2026": 2827 } } }], once: null });
check("a physician line without non-facility is not matched", office.block !== null && office.cents === null);
check("two files are not assigned to Physician", both.block !== null);
check("an ambulance code uses the ambulance file", ride.cents === 27709 && ride.label === "Ambulance");
check("modifier 26 is not priced from the full amount", part.block !== null && part.cents === null);
const openPerson = { id: "1", label: "Participant 1", county: "Cattaraugus", medicare: true, medicaid: true, esrd: false, age55: false, inArea: true, voluntary: true, community: true, loc: "open" };
check("Cattaraugus uses the 2026 PACE ratebook", medicareCents("Cattaraugus", 2026, false) === 126349);
check("Allegany uses the same 2026 PACE rate", medicareCents("Allegany", 2026, false) === 126349);
check("Erie uses the loaded grouped rate", medicareCents("Erie", 2026, false) === 139641);
check("ESRD replaces the county rate", medicareCents("Erie", 2026, true) === 1205155);
check("a person is not enrolled until every gate is met", canEnroll(openPerson) === false);
check("the month uses the Cattaraugus ratebook and does not invent Medicaid", monthLine(openPerson, 2026, null).medicare === 126349 && monthLine(openPerson, 2026, null).medicaid === null);
check("a Social Security number is refused", blockedText("123-45-6789") !== null);
check("the meeting names every required seat", missingSeats([...SEATS]).length === 0);
const ranked = rankBrief(["A meeting is missing the driver.", "Participant 1 is not enrolled. 55 or older is not marked.", "Participant 1: No Medicare county rate is loaded."]);
check("Rank puts enrollment ahead of the meeting", ranked.status === "pass" && ranked.order[0].includes("not enrolled") && ranked.chain[0] === "Screen" && ranked.chain.includes("Rank"));
const roll = rankInvoice({ look: 1, off: 2, match: 3 });
check("Rank puts an unpriced invoice line ahead of a match", roll.seat === "Rank" && roll.order[0] === "look" && roll.order[2] === "match");
check("Rank stops an invoice that asks to submit", rankInvoice({ look: 0, off: 0, match: 1 }, "submit the claim to CMS").status === "stop");
const memory = rankMemory();
check("Rank remembers the invoice order and not to invent a rate", memory.seatId === "takeover" && memory.keep.some((line) => line.includes("look, then off, then match")) && memory.keep.some((line) => line.includes("does not invent")));
check("Rank stops a request to submit", rankBrief([], "submit the claim to CMS").status === "stop");
const bridged = dailyBridge(
  [
    { name: "Physician fee schedule", status: "current", detail: "" },
    { name: "Personal care", status: "gap", detail: "" },
  ],
  "status only",
);
check("the daily check puts a gap ahead of a current file and does not fill it", bridged.status === "pass" && bridged.order[0].name === "Personal care" && bridged.order[0].action.includes("not filled") && bridged.order[0].action.includes("names the county") && bridged.chain.includes("Rank"));
check("a sheet that skips Cattaraugus is not applied there", placeOnSheet(["ERIE", "CHAUTAUQUA"], "Cattaraugus") === false);
check("a sheet that names Allegany can be used there", placeOnSheet(["Allegany", "Erie"], "ALLEGANY") === true);
check("the daily check stops a request to submit", dailyBridge([], "submit the claim to CMS").status === "stop");
const off = reasonLine({ code: "97110", year: 2026, billedCents: 3000, file: { cents: 2827, label: "Physician" } });
check("a higher invoice is off because it is over the file", off.verdict === "off" && off.steps.some((step) => step.includes("over")) && off.steps[0].includes("97110"));
const same = reasonLine({ code: "97110", year: 2026, billedCents: 2827, file: { cents: 2827, label: "Physician" } });
check("the same amount matches because the gap is one cent or less", same.verdict === "match" && same.steps.at(-1).includes("matches"));
const olderBill = reasonLine({
  code: "97110",
  year: 2026,
  billedCents: 3047,
  file: { cents: 2827, label: "Physician" },
  priors: [{ year: 2026, cents: 2827 }, { year: 2020, cents: 3047 }],
});
check("a bill that matches an older year is still off for this year", olderBill.verdict === "off" && olderBill.steps.some((step) => step.includes("2020") && step.includes("not used")));
check("an unchanged amount is not called a previous use", previousUse([{ year: 2026, cents: 2827 }, { year: 2025, cents: 2827 }], 2026, 2827, 2827) === null);
const emptyCounty = reasonMonth({ label: "Participant 1", county: "Cattaraugus", enrolled: true, gate: null, medicare: null, medicaid: null, esrd: false });
check("the month says why Cattaraugus is empty", emptyCounty.some((step) => step.includes("no Medicare")) && emptyCounty.at(-1).includes("skips"));
check("medicaid is not compared with Medicare when the state file is missing", checkLine({ ...claim.lines[0], chargeCents: 100 }, books, "medicaid", null).expectedCents === null);
const history = JSON.parse(readFileSync("public/history/summary.json", "utf8"));
const physician = history.families.find((row) => row.id === "physician");
const therapy = JSON.parse(readFileSync("public/history/physician.json", "utf8")).find((row) => row.c === "97110");
check("history counts the physician codes that changed", physician.changed === 7444 && physician.down === 5845);
check("97110 history is the 2020 amount down to 2026", therapy.from === 2020 && therapy.to === 2026 && therapy.fc === 3047 && therapy.tc === 2827);

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

import { quoteCode } from "../src/lib/billing/billing.ts";
import { describeCode } from "../src/lib/lookup/describe.ts";
import { canEnroll, blockedText, monthLine, missingSeats, SEATS } from "../src/lib/pace/gates.ts";
import { medicareCents } from "../src/lib/pace/rates.ts";
import { readInvoiceLines } from "../src/lib/lookup/check.ts";
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
check("a 2026 line can use a file from that year", pickOnce([{ s: "Part B drug", t: "October 2026", c: 13823, n: "Hep" }], 2026)?.c === 13823);
check("a 2024 line does not use a 2026-only file", pickOnce([{ s: "Part B drug", t: "October 2026", c: 13823, n: "Hep" }], 2024) === null);
const openPerson = { id: "1", label: "Participant 1", county: "Cattaraugus", medicare: true, medicaid: true, esrd: false, age55: false, inArea: true, voluntary: true, community: true, loc: "open" };
check("Cattaraugus has no loaded Medicare county rate", medicareCents("Cattaraugus", 2026, false) === null);
check("Erie uses the loaded grouped rate", medicareCents("Erie", 2026, false) === 139641);
check("ESRD replaces the county rate", medicareCents("Erie", 2026, true) === 1205155);
check("a person is not enrolled until every gate is met", canEnroll(openPerson) === false);
check("the month does not invent a Cattaraugus payment", monthLine(openPerson, 2026, null).medicare === null && monthLine({ ...openPerson, age55: true, loc: "met" }, 2026, 400000).missing.some((item) => item.includes("No Medicare")));
check("a Social Security number is refused", blockedText("123-45-6789") !== null);
check("the meeting names every required seat", missingSeats([...SEATS]).length === 0);
check("medicaid is not compared with Medicare when the state file is missing", checkLine({ ...claim.lines[0], chargeCents: 100 }, books, "medicaid", null).expectedCents === null);

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

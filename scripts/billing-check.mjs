import { quoteCode } from "../src/lib/billing/billing.ts";
import { readFileSync } from "node:fs";
import { workbookText } from "../src/lib/lookup/xlsx-read.ts";
import { readImportBytes } from "../src/lib/lookup/import-text.ts";
import { describeCode } from "../src/lib/lookup/describe.ts";
import { canEnroll, blockedText, monthLine, missingSeats, SEATS } from "../src/lib/pace/gates.ts";
import { medicareCents } from "../src/lib/pace/rates.ts";
import { dailyBridge, placeOnSheet } from "../src/lib/team/bridge.ts";
import { rankBrief, rankInvoice, rankMemory } from "../src/lib/team/rank.ts";
import { previousUse, reasonLine, reasonMonth } from "../src/lib/lookup/reason.ts";
import { readInvoiceLines, payBucket, paymentAlert, auditReport, gradeLookup } from "../src/lib/lookup/check.ts";
import { payLine, typeRollup } from "../src/lib/lookup/code-types.ts";
import { detectPosted } from "../src/lib/lookup/detect.ts";
import { lastPosted, morePosted, unknownBeside } from "../src/lib/lookup/reason.ts";
import { exportCheckCsv } from "../src/lib/lookup/export-check.ts";
import { feeTeamReport } from "../src/lib/team/fee-teams.ts";
import { answerFor, dropOldest } from "../src/lib/lookup/persist.ts";
import { pickSaved } from "../src/lib/lookup/saved-codes.ts";
import { auditPrice, dmePrice } from "../src/lib/lookup/schedule-price.ts";
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
const withNpi = "Code,Date,Charge,NPI\n97110,2026-03-01,28.27,1234567893";
check("an NPI does not block the invoice", rankInvoice({ look: 0, off: 0, match: 0 }, withNpi).status === "pass");
check("a social security number still stops the invoice", rankInvoice({ look: 0, off: 0, match: 0 }, "97110 123-45-6789 28.27").status === "stop");
const longInvoice = Array.from({ length: 400 }, () => "97110 2026-03-01 charge 28.27").join("\n");
check("a long invoice is not stopped for length", longInvoice.length > 8000 && rankInvoice({ look: 0, off: 0, match: 0 }, longInvoice).status === "pass");
const semi = readInvoiceLines("Code;Date;Charge\n97110;2026-03-01;28");
check("a semicolon sheet keeps the code and the dollars", semi.length === 1 && semi[0].code === "97110" && semi[0].billedCents === 2800);
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

const aaronText = await workbookText(new Uint8Array(readFileSync("attachments/AARON.xlsx")));
const aaron = readInvoiceLines(aaronText);
const oxygen = aaron.find((line) => line.code === "E0431" && line.modifier === "RR");
check("the workbook reads the oxygen line", oxygen?.year === 2025 && oxygen.billedCents === 5002 && oxygen.paidCents === 3094 && oxygen.units === 1 && oxygen.setting === "nf");
const visit = aaron.find((line) => line.code === "99213" && line.year === 2026);
check("the workbook keeps the 2026 office visit", visit?.setting === "nf" && visit.billedCents === 7416 && visit.paidCents === 7416);
const hospital = aaron.find((line) => line.code === "99232" && line.date === "2025-12-29");
check("a facility line is not read as the office", hospital?.setting === "fac");
check("a short code is named and not completed", aaron.length === 435 && aaronText.includes("SHORT 910") && aaronText.includes("SHORT 1844") && !aaron.some((line) => line.code === "00910" || line.code === "01844"));

function pdfBytes(line) {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET\n`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}endstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  body += "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function storeZip(entries) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    parts.push(local);
    const head = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(head.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    head.set(nameBytes, 46);
    central.push(head);
    offset += local.length;
  }
  const centralStart = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const pdf = await readImportBytes("bill.pdf", pdfBytes("97110 2026-03-01 charge 28.27"));
const pdfLine = "text" in pdf ? readInvoiceLines(pdf.text)[0] : null;
check("a pdf with text is read", pdfLine?.code === "97110" && pdfLine.year === 2026 && pdfLine.billedCents === 2827);
const scanned = await readImportBytes("scan.pdf", pdfBytes(""));
check("a pdf with no text is not guessed", "error" in scanned && scanned.error.includes("no text"));
const word = await readImportBytes("bill.docx", storeZip([["word/document.xml", "<w:document><w:p><w:r><w:t>A0428 2026-07-01 charge 250.00</w:t></w:r></w:p></w:document>"]]));
const wordLine = "text" in word ? readInvoiceLines(word.text)[0] : null;
check("a word document is read", wordLine?.code === "A0428" && wordLine.billedCents === 25000);
const page = await readImportBytes("bill.html", new TextEncoder().encode("<p>99213 2026-01-07 charge 91.86</p>"));
const pageLine = "text" in page ? readInvoiceLines(page.text)[0] : null;
check("an html file is read as text", pageLine?.code === "99213" && pageLine.billedCents === 9186);
const picture = await readImportBytes("scan.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
check("a picture is not read", "error" in picture && picture.error.includes("picture"));
const oldExcel = await readImportBytes("old.xls", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]));
check("an older excel file is not guessed", "error" in oldExcel && oldExcel.error.includes("no code"));

function rec(op, payload) {
  const out = new Uint8Array(4 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, op, true);
  view.setUint16(2, payload.length, true);
  out.set(payload, 4);
  return out;
}

function joinBytes(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function biffStream() {
  const code = new TextEncoder().encode("code");
  const charge = new TextEncoder().encode("charge");
  const cpt = new TextEncoder().encode("97110");
  const body = new Uint8Array(8 + 3 + code.length + 3 + charge.length + 3 + cpt.length);
  const view = new DataView(body.buffer);
  view.setUint32(0, 3, true);
  view.setUint32(4, 3, true);
  let pointer = 8;
  for (const word of [code, charge, cpt]) {
    view.setUint16(pointer, word.length, true);
    body[pointer + 2] = 0;
    body.set(word, pointer + 3);
    pointer += 3 + word.length;
  }
  const label = (row, col, index) => {
    const data = new Uint8Array(10);
    const item = new DataView(data.buffer);
    item.setUint16(0, row, true);
    item.setUint16(2, col, true);
    item.setUint32(6, index, true);
    return rec(0x00fd, data);
  };
  const amount = new Uint8Array(14);
  const money = new DataView(amount.buffer);
  money.setUint16(0, 1, true);
  money.setUint16(2, 1, true);
  money.setFloat64(6, 28.27, true);
  return joinBytes([rec(0x00fc, body), label(0, 0, 0), label(0, 1, 1), label(1, 0, 2), rec(0x0203, amount)]);
}

function entry(dir, index, name, type, start, size, child) {
  const view = new DataView(dir.buffer);
  const base = index * 128;
  for (let cursor = 0; cursor < name.length; cursor += 1) view.setUint16(base + cursor * 2, name.charCodeAt(cursor), true);
  view.setUint16(base + 0x40, (name.length + 1) * 2, true);
  dir[base + 0x42] = type;
  view.setUint32(base + 0x44, 0xffffffff, true);
  view.setUint32(base + 0x48, 0xffffffff, true);
  view.setUint32(base + 0x4c, child, true);
  view.setUint32(base + 0x74, start, true);
  view.setUint32(base + 0x78, size, true);
}

function tinyXls() {
  const stream = biffStream();
  const header = new Uint8Array(512);
  header.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  const view = new DataView(header.buffer);
  view.setUint16(0x1e, 9, true);
  view.setUint16(0x20, 6, true);
  view.setUint32(0x2c, 1, true);
  view.setUint32(0x30, 1, true);
  view.setUint32(0x38, 0, true);
  view.setUint32(0x3c, 0xfffffffe, true);
  view.setUint32(0x44, 0xfffffffe, true);
  for (let index = 0; index < 109; index += 1) view.setUint32(0x4c + index * 4, 0xffffffff, true);
  view.setUint32(0x4c, 0, true);
  const fat = new Uint8Array(512);
  const fatView = new DataView(fat.buffer);
  fatView.setUint32(0, 0xfffffffd, true);
  fatView.setUint32(4, 0xfffffffe, true);
  const sectors = Math.max(1, Math.ceil(stream.length / 512));
  for (let index = 0; index < sectors; index += 1) fatView.setUint32((2 + index) * 4, index + 1 < sectors ? 3 + index : 0xfffffffe, true);
  const directory = new Uint8Array(512);
  entry(directory, 0, "Root Entry", 5, 0xffffffff, 0, 1);
  entry(directory, 1, "Workbook", 2, 2, stream.length, 0xffffffff);
  const data = new Uint8Array(sectors * 512);
  data.set(stream);
  return joinBytes([header, fat, directory, data]);
}

const xls = await readImportBytes("old.xls", tinyXls());
const xlsLine = "text" in xls ? readInvoiceLines(xls.text)[0] : null;
check("an older excel workbook is read", xlsLine?.code === "97110" && xlsLine.billedCents === 2827);
const ods = await readImportBytes("bill.ods", storeZip([
  ["mimetype", "application/vnd.oasis.opendocument.spreadsheet"],
  ["content.xml", "<office:spreadsheet><table:table><table:table-row><table:table-cell><text:p>code</text:p></table:table-cell><table:table-cell><text:p>charge</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>A0428</text:p></table:table-cell><table:table-cell office:value=\"250\"><text:p>250.00</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>"],
]));
const odsLine = "text" in ods ? readInvoiceLines(ods.text)[0] : null;
check("an open document sheet is read", odsLine?.code === "A0428" && odsLine.billedCents === 25000);
const jsonBill = await readImportBytes("bill.json", new TextEncoder().encode(JSON.stringify([{ code: "99213", date: "2026-01-07", charge: 91.86 }])));
const jsonLine = "text" in jsonBill ? readInvoiceLines(jsonBill.text)[0] : null;
check("a json invoice is read", jsonLine?.code === "99213" && jsonLine.year === 2026 && jsonLine.billedCents === 9186);
const xmlBill = await readImportBytes("bill.xml", new TextEncoder().encode("<Workbook><Worksheet><Table><Row><Cell><Data>code</Data></Cell><Cell><Data>charge</Data></Cell></Row><Row><Cell><Data>G0463</Data></Cell><Cell><Data>550</Data></Cell></Row></Table></Worksheet></Workbook>"));
const xmlLine = "text" in xmlBill ? readInvoiceLines(xmlBill.text)[0] : null;
check("an xml spreadsheet is read", xmlLine?.code === "G0463" && xmlLine.billedCents === 55000);
const packed = btoa("97110 2026-03-01 charge 28.27");
const mail = await readImportBytes("bill.eml", new TextEncoder().encode(`Content-Type: text/plain\nContent-Transfer-Encoding: base64\n\n${packed}\n`));
const mailLine = "text" in mail ? readInvoiceLines(mail.text)[0] : null;
check("an email message is read", mailLine?.code === "97110" && mailLine.billedCents === 2827);
const zipped = await readImportBytes("bills.zip", storeZip([["bill.csv", "code,charge\n99232,74.15\n"]]));
const zipLine = "text" in zipped ? readInvoiceLines(zipped.text)[0] : null;
check("a zip of a csv is read", zipLine?.code === "99232" && zipLine.billedCents === 7415);
const pngText = new TextEncoder().encode(`Invoice${String.fromCharCode(0)}97110 2026-03-01 charge 28.27`);
const pngLength = new Uint8Array(4);
new DataView(pngLength.buffer).setUint32(0, pngText.length, false);
const png = joinBytes([
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngLength,
  new TextEncoder().encode("tEXt"),
  pngText,
  new Uint8Array(4),
  new Uint8Array([0, 0, 0, 0]),
  new TextEncoder().encode("IEND"),
  new Uint8Array(4),
]);
const pngRead = await readImportBytes("note.png", png);
const pngLine = "text" in pngRead ? readInvoiceLines(pngRead.text)[0] : null;
check("a picture that stores the line is read", pngLine?.code === "97110" && pngLine.billedCents === 2827);

const flateSource = new TextEncoder().encode("BT (E0431 2025-06-24 charge 50.02) Tj ET\n");
const flate = new Uint8Array(await new Response(new Blob([flateSource]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
const flateHead = new TextEncoder().encode(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n4 0 obj << /Length ${flate.length} /Filter /FlateDecode >> stream\n`);
const flateTail = new TextEncoder().encode("\nendstream\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF");
const flatePdf = new Uint8Array(flateHead.length + flate.length + flateTail.length);
flatePdf.set(flateHead, 0);
flatePdf.set(flate, flateHead.length);
flatePdf.set(flateTail, flateHead.length + flate.length);
const flateRead = await readImportBytes("flate.pdf", flatePdf);
const flateLine = "text" in flateRead ? readInvoiceLines(flateRead.text)[0] : null;
check("a compressed pdf is read", flateLine?.code === "E0431" && flateLine.billedCents === 5002);

const auditText = await workbookText(readFileSync(new URL("../attachments/AARON.xlsx", import.meta.url)));
const auditLines = readInvoiceLines(auditText);
const oxygenAudit = auditLines.find((line) => line.code === "E0431");
const hourAudit = auditLines.find((line) => line.code === "S9122" && line.units === 1.5);
const blankSchedule = auditLines.filter((line) => line.schedule === "none").length;
check("the client sheet keeps schedule, lookup, administrator payment, and sequestration", oxygenAudit?.schedule === "dme" && oxygenAudit.lookupCents === 3094 && oxygenAudit.adminCents === 2068 && oxygenAudit.billedCents === 5002 && oxygenAudit.seqRate === 0.98 && oxygenAudit.seqPayCents === 3032);
check("a fractional unit is kept", hourAudit?.units === 1.5 && hourAudit.schedule === "nursing" && hourAudit.lookupCents === 4312);
check("a blank schedule is not named for them", blankSchedule === 108);
const dme2025 = JSON.parse(readFileSync(new URL("../public/dme-2025.json", import.meta.url), "utf8"));
const oxygenFile = dmePrice(dme2025, oxygenAudit);
check("rural equipment prices the rental row", oxygenFile.cents === 3094 && oxygenFile.block === null);
const oxygenGrade = gradeLookup({ code: "E0431", year: 2025, units: 1, lookupCents: 3094, fileCents: oxygenFile.cents, adminCents: 2068, seqRate: 0.98, seqPayCents: 3032, block: null, note: null, otherCents: 2068 });
check("row 10 is the rural amount after 0.98, and their amount is the non-rural schedule", oxygenGrade.kind === "off" && oxygenGrade.gapCents === 964 && oxygenGrade.reasons[0].includes("Wrong fee schedule") && oxygenGrade.reasons[0].includes("$20.68") && oxygenGrade.reasons[0].includes("$30.32"));
const oxygenPay = payLine({ fileCents: 3094, units: 1, seqRate: 0.98, adminCents: 2068, otherCents: 2068 });
const labPay = payLine({ fileCents: 1000, units: 1, seqRate: 0.98, adminCents: 980, otherCents: null });
const rolled = typeRollup([
  { schedule: "dme", fileCents: 3094, units: 1, seqRate: 0.98, adminCents: 2068, otherCents: 2068 },
  { schedule: "lab", fileCents: 1000, units: 1, seqRate: 0.98, adminCents: 980, otherCents: null },
]);
check("a code type keeps the correct fee and names the wrong schedule", oxygenPay.payable === 3032 && oxygenPay.wrong && oxygenPay.gap === 964 && labPay.wrong === false && rolled.totals.wrongGap === 964 && rolled.groups[0].name === "Equipment");
const saved = JSON.parse(readFileSync(new URL("../public/saved-codes.json", import.meta.url), "utf8")).groups.flatMap((group) => group.rows);
const oxygenSaved = saved.find((row) => row.c === "E0431" && row.year === 2025);
check("missing codes are saved only when a file already had the dollar", oxygenSaved?.cents === 3094 && oxygenSaved.otherCents === 2068 && pickSaved(saved, "J1644", 2026, 10)?.cents === 20 && pickSaved(saved, "J1644", 2026, 3) === null && pickSaved(saved, "S9124", 2026, 6) === null && pickSaved(saved, "S9124", 2022, 6) === null);
const oxygenRows = [
  { c: "E0431", m: "RR", m2: "", rural: 3094, nr: 2068, name: "Portable gaseous oxygen" },
  { c: "E1390", m: "RR", m2: "", rural: 17332, nr: 9386, name: "Oxygen concentrator" },
  { c: "E1392", m: "RR", m2: "", rural: 5163, nr: 4959, name: "Portable oxygen concentrator" },
];
const foundOxygen = detectPosted({ code: "E0431", modifier: "RR", year: 2025, month: 6, schedule: "none", dme: oxygenRows, lab: null, ambulance: null, saved: [] });
const foundDrug = detectPosted({ code: "J1644", modifier: "", year: 2026, month: 10, schedule: "none", dme: null, lab: null, ambulance: null, saved });
const foundMarch = detectPosted({ code: "J1644", modifier: "", year: 2026, month: 3, schedule: "none", dme: null, lab: null, ambulance: null, saved });
const foundNamed = detectPosted({ code: "E0431", modifier: "RR", year: 2025, month: 6, schedule: "pfs", dme: oxygenRows, lab: [{ c: "E0431", m: "", rate: 100, name: "not a lab" }], ambulance: null, saved: [] });
check("a missing code is found on the posted file, with the related codes, and a named schedule is not switched", foundOxygen.use?.cents === 3094 && foundOxygen.related.includes("E1390") && foundDrug.use?.cents === 20 && foundMarch.use === null && foundNamed.use === null && foundNamed.elsewhere?.includes("was not used"));
const lookups = JSON.parse(readFileSync(new URL("../public/lookups.json", import.meta.url), "utf8")).rows;
const kept = dropOldest([
  { at: "2020-01-01", c: "old" },
  { at: "2024-01-01", c: "mid" },
  { at: "2026-01-01", c: "new" },
], 2);
check("an unknown stays unknown, a fraction of a cent is not loaded, and the oldest lookup is deleted first", answerFor(lookups, "G0467", 2026, 6)?.status === "unknown" && answerFor(lookups, "G0467", 2026, 6)?.payable === null && answerFor(lookups, "J2371", 2026, 10)?.payable === null && answerFor(lookups, "J2371", 2026, 3) === null && answerFor([{ c: "J1644", status: "known", cents: 20, at: "2026-10-01", year: 2026, months: [10, 11, 12], asOf: "file", related: [] }], "J1644", 2026, 10)?.payable === 20 && kept.map((row) => row.c).join(",") === "mid,new");
const teams = feeTeamReport([
  { pricedCents: 3094, block: null, adminCents: 2068, wrongSchedule: true, gapCents: 964 },
  { pricedCents: null, block: "Unknown. No posted dollar.", adminCents: null, wrongSchedule: false, gapCents: null },
]);
check("fee management, finder, and audit each take their own lines", teams.fee.count === 1 && teams.finder.count === 1 && teams.audit.wrong === 1 && teams.audit.gap === 964);
check("an unknown year shows the last posted year and does not use it", lastPosted([{ year: 2024, cents: 1800 }, { year: 2026, cents: 2000 }], 2026)?.cents === 1800 && lastPosted([{ year: 2022, cents: 100 }, { year: 2022, cents: 200 }], 2026)?.cents === null && unknownBeside(2026, [{ year: 2024, cents: 1800 }]).includes("was not used") && unknownBeside(2026, []).includes("No earlier year"));
const more = morePosted([2026], [{ c: "E0431", cents: 3094, otherCents: 2068, year: 2025, asOf: "DME25-D", place: "New York rural" }], [{ t: "October 2026", c: 20 }], "E0431");
check("a posted year the grid does not have is shown, and it is not used for another year", more.length === 1 && more[0].year === 2025 && more[0].cents === 3094 && more[0].other === 2068);
const savedCopy = exportCheckCsv([{ code: "E0431", modifier: "", date: "3/1/2026", year: 2026, units: 1, schedule: "dme", lookupCents: 3094, adminCents: 2068, seqRate: 0.98, seqPayCents: 3032, fileCents: 3094, otherCents: 2068, fileLabel: "New York rural", block: null, note: "Related, E1390" }]);
check("a saved copy has the file amount and leaves a missing dollar blank", savedCopy.includes("E0431") && savedCopy.includes("30.32") && savedCopy.includes("20.68") && savedCopy.includes("Wrong fee schedule") && exportCheckCsv([{ code: "J2003", modifier: "", date: "", year: 2026, units: 1, schedule: "none", lookupCents: null, adminCents: null, seqRate: null, seqPayCents: null, fileCents: null, otherCents: null, fileLabel: null, block: "Unknown for 2026.", note: null }]).includes("Unknown for 2026") && !exportCheckCsv([{ code: "J2003", modifier: "", date: "", year: 2026, units: 1, schedule: "none", lookupCents: null, adminCents: null, seqRate: null, seqPayCents: null, fileCents: null, otherCents: null, fileLabel: null, block: "Unknown for 2026.", note: null }]).includes(",0.00,"));
const poked = exportCheckCsv([{ code: "E0431", modifier: "", date: "", year: 2026, units: 1, schedule: "dme", lookupCents: null, adminCents: null, seqRate: null, seqPayCents: null, fileCents: null, otherCents: null, fileLabel: null, block: null, note: "=cmd|' /C calc'!A0" }]);
check("a saved copy does not let a note start a spreadsheet formula", poked.includes("'=cmd") && !poked.split("\n")[1].startsWith("="));
const unnamed = auditPrice({
  line: { code: "J1644", modifier: "JZ", year: 2026, month: 3, date: "2026-03-01", units: 1, billedCents: 100, paidCents: null, paidKind: null, setting: "nf", payer: null, ambiguous: false, chargeKnown: true, schedule: "none", lookupCents: null, adminCents: null, seqRate: null, seqPayCents: null },
  hits: [{ family: "physician", label: "Physician", row: { a: { "2026": 500 } } }],
  onceList: [],
  dme: null,
  lab: null,
  ambulance: null,
});
check("a blank schedule does not borrow a physician amount", Boolean(unnamed.block?.includes("did not name a schedule")) && unnamed.cents === null);

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

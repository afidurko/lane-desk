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

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

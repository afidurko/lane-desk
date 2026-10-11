import { parseInvoice, claimsFromInvoice } from "../src/lib/billing/invoice.ts";
import { buildPacket } from "../src/lib/billing/packet.ts";
import { submitterReady } from "../src/lib/billing/submitter.ts";
import { checkLine } from "../src/lib/billing/verify.ts";

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
  lines: [{ id: "l1", code: "97110", modifier: "", units: 1, chargeCents: 2827, allowedCents: 2827, schedule: "Physician", note: "exercise" }],
};
const client = { id: "org-1", name: "Olean General", npi: "1234567893" };
const packet = buildPacket(claim, client, submitter);
check("packet ready", packet.ready && packet.form === "837P" && packet.fields.submitterId === "NGS-1" && packet.cms1500.box26 === "OLN-1001");
const noNumber = buildPacket({ ...claim, number: "" }, client, submitter);
check("packet waits for claim number", !noNumber.ready && noNumber.missing.some((item) => item.includes("Claim number")));
const missing = buildPacket(claim, client, null);
check("packet waits for submitter", !missing.ready && missing.missing.some((item) => item.includes("submitter")));

const clear = checkLine(claim.lines[0], books);
check("unloaded code is high", clear.level === "high");

console.log(JSON.stringify({ ran, failCount: failures.length, failures }));
if (failures.length > 0) process.exit(1);

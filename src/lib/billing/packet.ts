import { allowedByLine, validDiagnosis, validNpi, withReduction, type Books, type Claim, type Client } from "@/lib/billing/billing";
import { claimGuards } from "@/lib/billing/guard";
import { submitterReady, type Submitter } from "@/lib/billing/submitter";

export type Packet = {
  ready: boolean;
  missing: string[];
  receiver: string;
  locality: string;
  form: "837P";
  cms1500: Cms1500;
  fields: {
    submitter: string;
    submitterId: string;
    billingNpi: string;
    payer: string;
    dos: string;
    pos: string;
    diagnosis: string;
    claimNumber: string;
    lines: {
      code: string;
      modifier: string;
      units: number;
      chargeCents: number | null;
      allowedCents: number | null;
      allowedTotalCents: number | null;
    }[];
  };
  next: string;
};

export type Cms1500 = {
  box1: string;
  box21: string;
  box24: { from: string; to: string; pos: string; code: string; modifier: string; units: number; chargeCents: number | null }[];
  box25: string;
  box31: string;
  box32: string;
  box33: string;
  box33a: string;
  box26: string;
};

const RECEIVER = "National Government Services, MAC 13282, Jurisdiction K";
const LOCALITY = "Rest of New York, locality 99, Olean 14760";
const SERVICE_FACILITY = "Olean, NY 14760 · Cattaraugus County";

/** A claim is ready to hand to an enrolled submitter. This function does not transmit it. */
export function buildPacket(claim: Claim, client: Client | null | undefined, submitter?: Submitter | null, books: Books | null = null, today = ""): Packet {
  const missing: string[] = [];
  if (!submitter || !submitterReady(submitter)) missing.push("Enrolled submitter with NPI and submitter ID");
  else if (!validNpi(submitter.npi)) missing.push("Submitter NPI that passes the check digit");
  if (!client) missing.push("Organization");
  else if (!validNpi(client.npi)) missing.push("Billing NPI that passes the check digit");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.dos)) missing.push("Date of service");
  if (!/^\d{2}$/.test(claim.pos)) missing.push("Place of service");
  if (!validDiagnosis(claim.diagnosis)) missing.push("Diagnosis code");
  if (!claim.number) missing.push("Claim number");
  if (claim.lines.length === 0) missing.push("At least one line");
  if (claim.lines.some((line) => line.chargeCents === null)) missing.push("A charge on every line");
  for (const guard of claimGuards(claim, books, today)) {
    if (!missing.includes(guard.reason)) missing.push(guard.reason);
  }

  const ready = missing.length === 0;
  const allowedTotals = allowedByLine(books?.physician?.rows ? withReduction(claim.lines, books, claim.payer ?? "medicare") : claim.lines);
  const payer = claim.payer === "medicaid" ? "NY Medicaid" : "Medicare Part B";
  const cms1500: Cms1500 = {
    box1: payer,
    box21: claim.diagnosis,
    box24: claim.lines.map((line) => ({
      from: claim.dos,
      to: claim.dos,
      pos: claim.pos,
      code: line.code,
      modifier: line.modifier,
      units: line.units,
      chargeCents: line.chargeCents,
    })),
    box25: "Not on this desk",
    box31: client?.name ?? "",
    box32: SERVICE_FACILITY,
    box33: client?.name ?? "",
    box33a: client?.npi ?? "",
    box26: claim.number,
  };

  return {
    ready,
    missing,
    receiver: RECEIVER,
    locality: LOCALITY,
    form: "837P",
    cms1500,
    fields: {
      submitter: submitter?.name ?? client?.name ?? "",
      submitterId: submitter?.submitterId ?? "",
      billingNpi: client?.npi ?? submitter?.npi ?? "",
      payer,
      dos: claim.dos,
      pos: claim.pos,
      diagnosis: claim.diagnosis,
      claimNumber: claim.number,
      lines: claim.lines.map((line) => ({
        code: line.code,
        modifier: line.modifier,
        units: line.units,
        chargeCents: line.chargeCents,
        allowedCents: line.allowedCents,
        allowedTotalCents: allowedTotals[line.id] ?? null,
      })),
    },
    next: ready
      ? "Packet includes the enrolled submitter. Hand it to the clearinghouse or MAC. This browser does not transmit."
      : `Next: ${missing[0]}.`,
  };
}

export function nextGap(
  claim: Claim | null,
  client: Client | null | undefined,
  submitter: Submitter | null | undefined,
  alertCount: number,
) {
  if (!client) return { title: "Add the organization", detail: "Nothing else opens until the organization is saved." };
  if (!validNpi(client.npi)) return { title: "Add a billing NPI", detail: "The packet needs a 10-digit NPI that passes the check digit." };
  if (!submitter || !submitterReady(submitter)) return { title: "Save the submitter", detail: "MAC 13282 needs a name, NPI, and submitter ID. Nothing is sent." };
  if (!validNpi(submitter.npi)) return { title: "Fix the submitter NPI", detail: "The check digit did not pass." };
  if (!claim || claim.lines.length === 0) return { title: "Add the service", detail: "Import an invoice, or type a code on the worksheet." };
  if (alertCount > 0) return { title: "Clear the high alert", detail: "Use the file amount on the flagged line, or dispute it. Ready stays blocked." };
  if (claim.lines.some((line) => line.chargeCents === null)) return { title: "Enter a charge", detail: "Every line needs a charge." };
  if (!claim.number) return { title: "Add a claim number", detail: "Letters, numbers, and hyphens. It lands in box 26." };
  if (!validDiagnosis(claim.diagnosis)) return { title: "Add a diagnosis code", detail: "Box 21 takes a code, such as M25.561, not a description." };
  if (!/^\d{2}$/.test(claim.pos)) return { title: "Set the place of service", detail: "Choose 11, 12, 41, 49, or 99." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.dos)) return { title: "Set the date of service", detail: "The file and sequestration both follow this date." };
  return { title: "Download the packet", detail: "It is complete for handoff. This browser does not transmit it." };
}

export function packetJson(claim: Claim, client: Client | null | undefined, submitter?: Submitter | null, books: Books | null = null, today = "") {
  const packet = buildPacket(claim, client, submitter, books, today);
  return JSON.stringify(
    {
      form: packet.form,
      receiver: packet.receiver,
      locality: packet.locality,
      ready: packet.ready,
      missing: packet.missing,
      cms1500: packet.cms1500,
      lines: packet.fields.lines,
    },
    null,
    2,
  );
}

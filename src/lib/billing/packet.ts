import type { Claim, Client } from "@/lib/billing/billing";
import { validNpi } from "@/lib/billing/billing";
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
    lines: { code: string; modifier: string; units: number; chargeCents: number | null; allowedCents: number | null }[];
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
export function buildPacket(claim: Claim, client: Client | null | undefined, submitter?: Submitter | null): Packet {
  const missing: string[] = [];
  if (!submitter || !submitterReady(submitter)) missing.push("Enrolled submitter with NPI and submitter ID");
  else if (!validNpi(submitter.npi)) missing.push("Submitter NPI that passes the check digit");
  if (!client) missing.push("Organization");
  else if (!validNpi(client.npi)) missing.push("Billing NPI that passes the check digit");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.dos)) missing.push("Date of service");
  if (!/^\d{2}$/.test(claim.pos)) missing.push("Place of service");
  if (!claim.number) missing.push("Claim number");
  if (claim.lines.length === 0) missing.push("At least one line");
  if (claim.lines.some((line) => line.chargeCents === null)) missing.push("A charge on every line");

  const ready = missing.length === 0;
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
      })),
    },
    next: ready
      ? "Packet includes the enrolled submitter. Hand it to the clearinghouse or MAC. This browser does not transmit."
      : "Fill the missing fields, including the submitter, before the packet can be handed off.",
  };
}

export function packetJson(claim: Claim, client: Client | null | undefined, submitter?: Submitter | null) {
  const packet = buildPacket(claim, client, submitter);
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

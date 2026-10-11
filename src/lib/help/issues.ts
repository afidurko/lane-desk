import { scanRequest } from "@/lib/compliance/boundary";

export type IssueKind = "workable" | "stop" | "ask";

export type IssueReply = {
  kind: IssueKind;
  title: string;
  body: string;
  href?: "/billing" | "/book" | "/desk" | "/ny" | "/operate" | "/filter";
  hrefLabel?: string;
  suggestions: string[];
};

const WORKABLE: { test: RegExp; reply: IssueReply }[] = [
  {
    test: /modifier|gp\b|go\b|gn\b|discipline/i,
    reply: {
      kind: "workable",
      title: "Add the therapy modifier",
      body: "Medicare outpatient therapy needs GP, GO, or GN. Ready stays blocked until one of those is on the line. This desk does not choose the discipline for you.",
      href: "/billing",
      hrefLabel: "Open the claim",
      suggestions: ["The amount does not match", "Add a diagnosis code"],
    },
  },
  {
    test: /wrong year|2025 file|2024 file|date of service year|timely/i,
    reply: {
      kind: "workable",
      title: "Use the file for that year",
      body: "The claim loads the fee file for the date of service, from 2020 through 2026. A 2026 amount is not billed for another year. A date more than 12 months old stays blocked.",
      href: "/billing",
      hrefLabel: "Open the claim",
      suggestions: ["Use the date of service", "Sequestration is 2 percent"],
    },
  },
  {
    test: /adequate notes?|no notes?|without a note|thin note|not enough|missing notes?|don.?t have (adequate |a |any )?notes?/i,
    reply: {
      kind: "workable",
      title: "You do not need a fuller note",
      body: "The clock reads physical, occupational, and speech therapy codes from the 2026 file, by the code or the description. It does not guess an office visit, a lab, or wound care. If the note has none of those, open the table and pick the code.",
      href: "/filter",
      hrefLabel: "Open the table",
      suggestions: ["Look up a code", "Import an invoice"],
    },
  },
  {
    test: /high alert|wrong amount|does not match|doesn't match|incorrect (claim|code|amount)|amount (is|was) wrong|file amount/i,
    reply: {
      kind: "workable",
      title: "The amount does not match",
      body: "Open the claim. A high alert names the code on the Olean file and the amount it allows. Change the billed amount to that figure, or dispute the line. The alert stays until the numbers agree.",
      href: "/billing",
      hrefLabel: "Open the claim",
      suggestions: ["Use the file amount", "The code is not on the file"],
    },
  },
  {
    test: /import|csv|spreadsheet|invoice file|upload/i,
    reply: {
      kind: "workable",
      title: "Import the invoice",
      body: "Save the organization first. Then import a CSV with a code column and an amount column. One claim opens per entity.",
      href: "/billing",
      hrefLabel: "Import an invoice",
      suggestions: ["Add the organization", "One claim per entity"],
    },
  },
  {
    test: /claim number|box 26/i,
    reply: {
      kind: "workable",
      title: "Add the claim number",
      body: "On the open claim, use letters, numbers, and hyphens, up to 20 characters. Ready stays blocked until box 26 is filled.",
      href: "/billing",
      hrefLabel: "Open the claim",
      suggestions: ["Add a diagnosis code", "Save the submitter"],
    },
  },
  {
    test: /diagnos|icd|pointer/i,
    reply: {
      kind: "workable",
      title: "Add the diagnosis pointer",
      body: "Box 21 needs a code, such as M25.561. A description is rejected. Ready stays blocked while it is blank.",
      href: "/billing",
      hrefLabel: "Open the claim",
      suggestions: ["Add a claim number", "Set the place of service"],
    },
  },
  {
    test: /submitter|organization|missing npi|\bnpi\b|check digit/i,
    reply: {
      kind: "workable",
      title: "Save who is billing",
      body: "Add the organization and a 10-digit NPI that passes the check digit. Then save the submitter ID for MAC 13282. A blank NPI used to pass the form and fail the packet.",
      href: "/billing",
      hrefLabel: "Open the claim",
      suggestions: ["Fix the submitter NPI", "Import an invoice"],
    },
  },
  {
    test: /quarter|vintage|out of date|wrong year|date of service|file window/i,
    reply: {
      kind: "workable",
      title: "Use the date of service",
      body: "Physician and ambulance files are annual. Lab, drug, outpatient, and surgical center files are quarterly. A date outside that window is flagged. Change the date or the file, not the dollar.",
      href: "/book",
      hrefLabel: "Look up the code",
      suggestions: ["Sequestration is 2 percent", "This desk is Rest of New York"],
    },
  },
  {
    test: /sequester/i,
    reply: {
      kind: "workable",
      title: "Sequestration is 2 percent",
      body: "For a date of service on or after July 1, 2022, sequestration cuts the Medicare payment, not the fee on the file.",
      href: "/book",
      hrefLabel: "Look up the code",
      suggestions: ["The amount does not match", "Use the date of service"],
    },
  },
  {
    test: /locality|mac\b|olean|14760|rest of new york/i,
    reply: {
      kind: "workable",
      title: "This desk is Rest of New York",
      body: "Olean 14760 is MAC 13282, locality 99. New York Medicaid is a separate amount on the New York page.",
      href: "/ny",
      hrefLabel: "Compare New York",
      suggestions: ["Look up a code", "Sequestration is 2 percent"],
    },
  },
  {
    test: /multiple entit|two entit|several entit|per entity|npi:/i,
    reply: {
      kind: "workable",
      title: "One claim per entity",
      body: "Start each group with “Entity: name” or “NPI:” and ten digits. Opening the invoice makes one claim per entity. Each still needs a diagnosis and a submitter.",
      href: "/billing",
      hrefLabel: "Import an invoice",
      suggestions: ["Add a diagnosis code", "Save the submitter"],
    },
  },
  {
    test: /\b([A-Z]\d{4}|\d{5})\b|code not found|can't find|cannot find|look up|not on the file/i,
    reply: {
      kind: "workable",
      title: "Look the code up",
      body: "Open Codes and set the year. If no row is loaded, the line stays a high alert. The desk does not invent a price, and Use the file amount stays hidden.",
      href: "/book",
      hrefLabel: "Look up the code",
      suggestions: ["The amount does not match", "Use the date of service"],
    },
  },
];

const STOPS: Record<string, IssueReply> = {
  phi: {
    kind: "stop",
    title: "Not workable. An identifier was in the message",
    body: "The message was dropped and is not shown. Take out the name, number, or date of birth, then describe the code and the amount only.",
    suggestions: ["Look up a code", "The amount does not match"],
  },
  submit: {
    kind: "stop",
    title: "Not workable. This desk does not send a claim",
    body: "Mark ready only after the packet is complete, then download it. Sending stays in an enrolled system.",
    href: "/billing",
    hrefLabel: "Prepare the packet",
    suggestions: ["Save the submitter", "Add a claim number"],
  },
  portal: {
    kind: "stop",
    title: "Not workable. No portal login",
    body: "This desk does not sign in to a Medicare portal, PECOS, or NPPES. Use the files already loaded.",
    href: "/book",
    hrefLabel: "Use the loaded files",
    suggestions: ["Look up a code", "This desk is Rest of New York"],
  },
  scrape: {
    kind: "stop",
    title: "Not workable. Nothing is scraped",
    body: "Rates come from the files on this desk. A page on the public web is not fetched from here.",
    suggestions: ["Look up a code", "Use the date of service"],
  },
  hpi: {
    kind: "stop",
    title: "Not workable. An HPI is not written here",
    body: "Describe the service in a few words, such as therapeutic exercise for 15 minutes. Do not ask for a history.",
    href: "/desk",
    hrefLabel: "Price a short note",
    suggestions: ["Look up a code", "Import an invoice"],
  },
  record: {
    kind: "stop",
    title: "Not workable. A chart is not stored",
    body: "The message was not kept. Price a de-identified line, or import an invoice that has codes and amounts only.",
    href: "/billing",
    hrefLabel: "Import an invoice",
    suggestions: ["Import an invoice", "Look up a code"],
  },
  transmit: {
    kind: "stop",
    title: "Not workable. Nothing is transmitted",
    body: "Download the packet. It is not faxed or sent to Medicare, an EHR, or a portal.",
    href: "/billing",
    hrefLabel: "Download stays on the claim",
    suggestions: ["Save the submitter", "Clear the high alert"],
  },
};

const ASK: IssueReply = {
  kind: "ask",
  title: "Say what is stuck",
  body: "The claim fails closed: no organization, no billing NPI, no submitter, no line, a high alert, a missing charge, claim number, diagnosis, or place of service. A name, a sent claim, a portal, or a chart is a stop.",
  suggestions: ["Add the organization", "The amount does not match", "Can this be submitted?"],
};

/** Classify a help message. A stopped message is not returned. */
export function classifyIssue(input: string): IssueReply {
  const scan = scanRequest(input);
  if (scan.decision === "stop") {
    return STOPS[scan.reason] ?? STOPS.record;
  }
  if (/\b(submitted|submission)\b/i.test(input)) return STOPS.submit;
  const hit = WORKABLE.find((item) => item.test.test(input));
  return hit?.reply ?? ASK;
}

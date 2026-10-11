import type { Line } from "@/lib/desk/clock";
import { serviceOf, SCHEDULE } from "@/lib/desk/schedule";

type Status = "did-not-run" | "stop" | "hold" | "pass";

export type Member = { role: string; job: string };

export type TeamReport = {
  id: string;
  name: string;
  lead: string;
  status: Status;
  detail: string;
  members: Member[];
};

const SHIELD: Member[] = [
  { role: "boundary", job: "Stop a name, member number, or a request to submit." },
  { role: "de-id", job: "The note stays on this browser or it is cleared." },
];

const CLAIMS: Member[] = [
  { role: "stopwatch", job: "Read the note. Name the code and the units." },
  { role: "gold-set", job: "A clinician label is still required. Do not invent one." },
];

const CODES: Member[] = [
  { role: "pfs", job: "Verify the rate against the loaded Rest of New York file." },
  { role: "qa", job: "Units times the schedule rate. Reject a mismatch." },
];

const INTEL: Member[] = [
  { role: "public scan", job: "Cite a public fact. Do not scrape a portal." },
];

const HUNT: Member[] = [
  { role: "target list", job: "Named PACE centers. Not a claim and not a price." },
];

const HANDOFF: Member[] = [
  { role: "scoreboard", job: "Record the result so the next seat can pick it up." },
];

const TAKEOVER: Member[] = [
  { role: "wedge", job: "Keep the stopwatch. Kill full EHR, PE bids, and live PHI." },
  { role: "brief", job: "Write the Kai brief from what the seats produced." },
];

const KAI: Member[] = [
  { role: "file", job: "File the brief. Pull Aaron only for a decision." },
];

function seat(
  id: string,
  name: string,
  lead: string,
  members: Member[],
  status: Status,
  detail: string,
): TeamReport {
  return { id, name, lead, status, detail, members };
}

function idle(id: string, name: string, lead: string, members: Member[], detail = "Has not run."): TeamReport {
  return seat(id, name, lead, members, "did-not-run", detail);
}

export const IDLE_TEAMS: TeamReport[] = [
  idle("seat.shield", "Shield", "Shield", SHIELD),
  idle("seat.claims", "Claims Wedge", "Claims Wedge", CLAIMS),
  idle("seat.codes", "CMS Codes", "CMS Codes", CODES),
  idle("seat.intel", "Incumbent Intel", "Incumbent Intel", INTEL),
  idle("seat.hunt", "Center Hunt", "Center Hunt", HUNT, "Does not run on a note. Owns the center list."),
  idle("seat.handoff", "Handoff", "Handoff", HANDOFF),
  idle("seat.takeover", "Takeover", "Takeover", TAKEOVER),
  idle("seat.kai", "Kai", "Kai", KAI),
];

export function teamReports(kind: "closed" | "refused" | "priced", lines: Line[], timed: boolean): TeamReport[] {
  const hunt = idle("seat.hunt", "Center Hunt", "Center Hunt", HUNT, "Did not run. A note is not a center list.");
  if (kind === "closed") {
    return IDLE_TEAMS.map((item) =>
      item.id === "seat.hunt" ? item : { ...item, detail: "Did not run." },
    );
  }
  if (kind === "refused") {
    return [
      seat("seat.shield", "Shield", "Shield", SHIELD, "pass", "No identifier. Size is inside the limit."),
      seat("seat.claims", "Claims Wedge", "Claims Wedge", CLAIMS, "stop", "No work unit on the adult-day therapy schedule."),
      idle("seat.codes", "CMS Codes", "CMS Codes", CODES, "Did not run. Claims did not name a code."),
      idle("seat.intel", "Incumbent Intel", "Incumbent Intel", INTEL, "Did not run."),
      hunt,
      idle("seat.handoff", "Handoff", "Handoff", HANDOFF, "Nothing to record."),
      seat("seat.takeover", "Takeover", "Takeover", TAKEOVER, "stop", "Wedge stopped. No priced line to rank."),
      seat("seat.kai", "Kai", "Kai", KAI, "pass", "Filed the stop. Nothing was priced."),
    ];
  }
  const cited = lines
    .map((line) => {
      const service = serviceOf(line.code);
      return service ? `${line.code} ${service.name}, $${service.unitDollars.toFixed(2)}` : line.code;
    })
    .join("; ");
  const arithmetic = lines.every((line) => {
    const service = serviceOf(line.code);
    if (!service) return false;
    return Math.round(line.units * service.unitDollars * 100) / 100 === line.allowed;
  });
  return [
    seat("seat.shield", "Shield", "Shield", SHIELD, "pass", "No identifier. Size is inside the limit. Text was not stored."),
    seat(
      "seat.claims",
      "Claims Wedge",
      "Claims Wedge",
      CLAIMS,
      "pass",
      `${lines.length} line${lines.length === 1 ? "" : "s"}: ${lines.map((line) => `${line.code} × ${line.units}`).join(", ")}. Provisional until a clinician labels it.`,
    ),
    seat(
      "seat.codes",
      "CMS Codes",
      "CMS Codes",
      CODES,
      arithmetic ? "pass" : "stop",
      arithmetic
        ? `${cited}. Source: ${SCHEDULE.name}, ${SCHEDULE.setting}, ${SCHEDULE.asOf}.`
        : "Stopped. The arithmetic does not match the loaded schedule.",
    ),
    seat(
      "seat.intel",
      "Incumbent Intel",
      "Incumbent Intel",
      INTEL,
      "pass",
      "Standing public fact only. No new scan was run.",
    ),
    hunt,
    seat(
      "seat.handoff",
      "Handoff",
      "Handoff",
      HANDOFF,
      timed ? "pass" : "hold",
      timed ? "Both clocks are filled. The row can move." : "Hold. The human desk has not been timed.",
    ),
    seat(
      "seat.takeover",
      "Takeover",
      "Takeover",
      TAKEOVER,
      arithmetic ? "pass" : "stop",
      arithmetic
        ? "Wedge is the adult-day therapy stopwatch. Not an EHR. Not a bid."
        : "Wedge stopped. CMS Codes rejected the price.",
    ),
    seat(
      "seat.kai",
      "Kai",
      "Kai",
      KAI,
      "pass",
      arithmetic ? "Filed the brief. No decision needed." : "Filed the stop.",
    ),
  ];
}

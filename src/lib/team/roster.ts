/** Real Hostile Takeover seats. Ids are the live agents. The desk does not call them. A cleared packet is queued for them. */

export type Seat = {
  id: string;
  agentId: string;
  name: string;
  reportsTo: string;
  job: string;
  doesNot: string;
};

export const SEATS: readonly Seat[] = [
  {
    id: "shield",
    agentId: "310276d9-b7e7-42f3-b255-be778d613270",
    name: "Shield",
    reportsTo: "Takeover",
    job: "Boundary. De-identify. Stop a name, a member number, a submit, a portal, or a scrape.",
    doesNot: "Does not price. Does not write a brief.",
  },
  {
    id: "claims",
    agentId: "9541e54a-26cb-4ec0-9133-f3c7838b4af4",
    name: "Claims Wedge",
    reportsTo: "Takeover",
    job: "Stopwatch. De-identified note to a provisional code and units.",
    doesNot: "Does not invent a clinician label. Does not replace an EHR.",
  },
  {
    id: "codes",
    agentId: "d10b8622-f61e-4f67-865e-fa7ad14e5bda",
    name: "CMS Codes",
    reportsTo: "Takeover",
    job: "Verify the provisional code and rate against the loaded fee file.",
    doesNot: "Does not invent a rate. Does not search a portal.",
  },
  {
    id: "intel",
    agentId: "e909ce1b-b9a3-471b-a451-5ed70e3314ce",
    name: "Incumbent Intel",
    reportsTo: "Takeover",
    job: "Public competitive facts only.",
    doesNot: "Does not price a note. Does not scrape.",
  },
  {
    id: "hunt",
    agentId: "b414f8b1-9cf9-4df1-a85a-871f6540e5db",
    name: "Center Hunt",
    reportsTo: "Takeover",
    job: "Named PACE center list.",
    doesNot: "Does not run on a note.",
  },
  {
    id: "handoff",
    agentId: "aa1aece7-5315-4341-8173-a77afce223e5",
    name: "Handoff",
    reportsTo: "Takeover",
    job: "Scoreboard and blockers. Closes a dropped handoff.",
    doesNot: "Does not build a demo.",
  },
  {
    id: "takeover",
    agentId: "693e30d9-a47b-4213-9423-eb86f6b9789d",
    name: "Takeover",
    reportsTo: "Kai",
    job: "Ranks the wedge. Writes the brief. Kills full EHR, PE bids, and live PHI.",
    doesNot: "Does not message Aaron directly.",
  },
  {
    id: "kai",
    agentId: "a3a7bf46-1afe-4656-a95d-0aec141b6940",
    name: "Kai",
    reportsTo: "Aaron",
    job: "Files the brief. Pulls Aaron only for a decision.",
    doesNot: "Does not price. Does not label a gold row.",
  },
] as const;

export const CHAIN = ["shield", "claims", "codes", "takeover", "kai"] as const;

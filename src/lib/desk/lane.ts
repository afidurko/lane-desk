import { money, review, type Gate, type Line } from "@/lib/desk/clock";
import { SCHEDULE } from "@/lib/desk/schedule";
import type { DeskRow } from "@/lib/desk/store";
import { teamReports, type TeamReport } from "@/lib/desk/teams";
import { judgeProof, proofIdle, type ProofReport } from "@/lib/desk/proof";
import { recordAudit } from "@/lib/compliance/audit";
import { scanRequest } from "@/lib/compliance/boundary";

export type Status = "did-not-run" | "stop" | "hold" | "pass";

export type Layer = {
  id: "gate" | "claims" | "intel" | "proof" | "kai";
  name: string;
  status: Status;
  detail: string;
};

export type Brief = {
  to: "Kai";
  from: "Proof";
  wedge: string;
  proofPath: string;
  measuredDelta: string;
  intel: string;
  decision: string;
};

export type LaneRun = {
  layers: Layer[];
  lines: Line[];
  allowed: number;
  text: string;
  patches: string[];
  block: Exclude<Gate, "ok"> | null;
  brief: Brief | null;
  ship: boolean;
  scriptSeconds: number | null;
  humanSeconds: number | null;
  teams: TeamReport[];
  proof: ProofReport;
  boundary: string | null;
};

const PUBLIC_FACT =
  "Collabrios Health announced CollabriosONE on September 17, 2026. The company said the platform joins clinical care, transportation, enrollment, home-based care, an ambient scribe, claims, and analytics, and moves PACECare, TruChart, and PACELogic onto it.";

const GATE_DETAIL: Record<Exclude<Gate, "ok">, string> = {
  empty: "No note.",
  phi: "Stopped. The note looks like an identifier.",
  oversize: "Stopped. The note is past the size limit.",
  units: "Stopped. A line is outside 1 to 8 units.",
  split: "Stopped. Two services are on the same line.",
  "wrong-type": "Stopped. The note is not on the adult-day therapy schedule.",
};

export const IDLE: Layer[] = [
  { id: "gate", name: "Gate", status: "did-not-run", detail: "Has not run." },
  { id: "claims", name: "Claims Wedge", status: "did-not-run", detail: "Has not run." },
  { id: "intel", name: "Incumbent Intel", status: "did-not-run", detail: "Has not run." },
  { id: "proof", name: "Proof", status: "did-not-run", detail: "Has not run." },
  { id: "kai", name: "Kai", status: "did-not-run", detail: "Has not run." },
];

/** Public record only. This function takes no note. */
export function incumbentIntel() {
  return {
    fact: PUBLIC_FACT,
    detail: "Standing public fact. No new scan was run, so nothing else was added.",
  };
}

function skipped(id: Layer["id"], name: string): Layer {
  return { id, name, status: "did-not-run", detail: "Did not run." };
}

function pathFrom(lines: Line[]) {
  return lines
    .map((line) => `${line.code} · ${line.units} unit${line.units === 1 ? "" : "s"} · ${money(line.allowed)}`)
    .join("; ");
}

function deltaFrom(scriptSeconds: number | null, humanSeconds: number | null) {
  if (scriptSeconds === null || humanSeconds === null) return "None.";
  const delta = Math.round((humanSeconds - scriptSeconds) * 100) / 100;
  return `${delta}s. Script ${scriptSeconds.toFixed(2)}s, human ${humanSeconds}s.`;
}

export function runLane(
  note: string,
  humanSeconds: number | null,
  scriptSeconds: number | null,
  rates?: Record<string, number>,
): LaneRun {
  const scan = scanRequest(note);
  if (scan.decision === "stop") {
    recordAudit({ skill: "boundary-scan", decision: "stop", reason: scan.reason });
    return {
      layers: [
        { id: "gate", name: "Gate", status: "stop", detail: scan.detail },
        skipped("claims", "Claims Wedge"),
        skipped("intel", "Incumbent Intel"),
        skipped("proof", "Proof"),
        skipped("kai", "Kai"),
      ],
      lines: [],
      allowed: 0,
      text: "",
      patches: [],
      block: scan.reason === "phi" ? "phi" : null,
      brief: null,
      ship: false,
      scriptSeconds,
      humanSeconds,
      teams: teamReports("closed", [], false),
      proof: proofIdle(),
      boundary: scan.detail,
    };
  }

  const reviewed = review(note, rates);
  const allowed =
    reviewed.lines.length === 0
      ? 0
      : Math.round(reviewed.lines.reduce((total, line) => total + line.allowed, 0) * 100) / 100;
  const base = {
    lines: reviewed.gate === "ok" ? reviewed.lines : [],
    allowed: reviewed.gate === "ok" ? allowed : 0,
    text: reviewed.text,
    patches: reviewed.patches,
    ship: false,
    scriptSeconds,
    humanSeconds,
  };

  if (reviewed.gate === "empty" || reviewed.gate === "phi" || reviewed.gate === "oversize") {
    return {
      ...base,
      lines: [],
      allowed: 0,
      block: reviewed.gate,
      brief: null,
      teams: teamReports("closed", [], false),
      proof: proofIdle(),
      boundary: null,
      text: reviewed.gate === "phi" ? "" : base.text,
      layers: [
        { id: "gate", name: "Gate", status: "stop", detail: GATE_DETAIL[reviewed.gate] },
        skipped("claims", "Claims Wedge"),
        skipped("intel", "Incumbent Intel"),
        skipped("proof", "Proof"),
        skipped("kai", "Kai"),
      ],
    };
  }

  const gate: Layer = { id: "gate", name: "Gate", status: "pass", detail: "No identifier. Size is inside the limit." };

  if (reviewed.gate !== "ok") {
    const claims: Layer = { id: "claims", name: "Claims Wedge", status: "stop", detail: GATE_DETAIL[reviewed.gate] };
    const judged = judgeProof(reviewed.text, false, false);
    const brief: Brief = {
      to: "Kai",
      from: "Proof",
      wedge: "None. Claims did not price a line.",
      proofPath: claims.detail,
      measuredDelta: "None.",
      intel: "None. Intel did not run.",
      decision: "Stop.",
    };
    return {
      ...base,
      lines: [],
      allowed: 0,
      block: reviewed.gate,
      brief,
      teams: teamReports("refused", [], false),
      proof: judged,
      boundary: null,
      layers: [
        gate,
        claims,
        skipped("intel", "Incumbent Intel"),
        { id: "proof", name: "Proof", status: "stop", detail: judged.detail },
        { id: "kai", name: "Kai", status: "pass", detail: "Filed the stop. Nothing was priced." },
      ],
    };
  }

  const claims: Layer = {
    id: "claims",
    name: "Claims Wedge",
    status: "pass",
    detail: pathFrom(reviewed.lines),
  };
  const intelSource = incumbentIntel();
  const intel: Layer = { id: "intel", name: "Incumbent Intel", status: "pass", detail: intelSource.detail };
  const timed = humanSeconds !== null && scriptSeconds !== null;
  const judged = judgeProof(reviewed.text, true, timed);
  const killed = judged.status === "stop";
  const proofLayer: Layer = { id: "proof", name: "Proof", status: judged.status, detail: judged.detail };
  const brief: Brief = {
    to: "Kai",
    from: "Proof",
    wedge: killed ? "None. Proof stopped the scope." : `${SCHEDULE.name}, ${SCHEDULE.setting}, ${SCHEDULE.asOf}.`,
    proofPath: killed ? judged.detail : claims.detail,
    measuredDelta: judged.status === "pass" ? deltaFrom(scriptSeconds, humanSeconds) : "None.",
    intel: intelSource.fact,
    decision:
      judged.status === "pass" ? "None." : judged.status === "hold" ? "Hold. Do not ship a measured delta." : "Stop.",
  };
  const teams = teamReports("priced", reviewed.lines, killed ? false : timed);
  if (killed) teams[3] = { ...teams[3], status: "stop", detail: judged.detail };
  return {
    ...base,
    block: null,
    brief,
    ship: judged.status === "pass" && teams[2].status === "pass",
    teams,
    proof: judged,
    boundary: null,
    layers: [
      gate,
      claims,
      intel,
      proofLayer,
      { id: "kai", name: "Kai", status: "pass", detail: killed ? "Filed the kill." : timed ? "Brief is complete." : "Brief is a hold. The delta field is empty." },
    ],
  };
}

export function briefFromRows(rows: DeskRow[]): Brief | null {
  if (rows.length === 0) return null;
  const newest = rows[0];
  const sameRun = rows.filter((row) => row.at === newest.at);
  const timed = newest.humanSeconds !== null && newest.scriptSeconds !== null;
  return {
    to: "Kai",
    from: "Proof",
    wedge: `${SCHEDULE.name}, ${SCHEDULE.setting}, ${SCHEDULE.asOf}.`,
    proofPath: sameRun
      .map((row) => `${row.code} · ${row.units} unit${row.units === 1 ? "" : "s"} · ${money(row.allowed)}`)
      .join("; "),
    measuredDelta: timed ? deltaFrom(newest.scriptSeconds, newest.humanSeconds) : "None.",
    intel: incumbentIntel().fact,
    decision: timed ? "None." : "Hold. Do not ship a measured delta.",
  };
}

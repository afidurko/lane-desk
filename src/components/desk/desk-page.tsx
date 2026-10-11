import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/landing/shell";
import { readBilling, writeBilling } from "@/lib/billing/store";
import { money, SAMPLE_NOTE, SERVICES, type Gate } from "@/lib/desk/clock";
import { briefFromRows, runLane, type LaneRun } from "@/lib/desk/lane";
import { IDLE_TEAMS } from "@/lib/desk/teams";
import { readRows, sealRow, writeRows, type DeskRow } from "@/lib/desk/store";
import { conversionFor, localityDollars, type PfsFile, type PfsRow } from "@/lib/book/price";
import { addGold } from "@/lib/team/gold";
import { makePacket, readQueue, writeQueue } from "@/lib/team/protocol";
import { addBoard } from "@/lib/team/scoreboard";

const STEPS = ["Read the note", "Assign a code", "Price the allowed amount", "Tie the line to the note"] as const;
const MARKS_MS = [420, 980, 1540, 2100];
const DONE_MS = 2300;

const GATE_COPY: Record<Exclude<Gate, "ok">, string> = {
  empty: "Paste a de-identified note first.",
  phi: "The base gate stopped this note. It looks like an identifier. Nothing was saved.",
  oversize: "The base gate stopped this note. It is past the size limit. Nothing was saved.",
  units: "Each code on this schedule prices 1 to 8 units. This note is outside that range. Nothing was saved.",
  split: "Two codes are on the same line. Put each service on its own line. Nothing was saved.",
  "wrong-type":
    "This clock only prices the six adult-day therapy codes on the 2026 national schedule. Anything else does not get a price.",
};

type Phase = "idle" | "running" | "done";

export function DeskPage() {
  const [note, setNote] = useState(SAMPLE_NOTE);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [block, setBlock] = useState<Exclude<Gate, "ok"> | null>(null);
  const [boundary, setBoundary] = useState<string | null>(null);
  const [lane, setLane] = useState<LaneRun | null>(null);
  const [human, setHuman] = useState("");
  const [rows, setRows] = useState<DeskRow[]>([]);
  const [ready, setReady] = useState(false);
  const [kept, setKept] = useState(false);
  const [sent, setSent] = useState(false);
  const [queued, setQueued] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [patches, setPatches] = useState<string[]>([]);
  const timeouts = useRef<number[]>([]);
  const interval = useRef<number | null>(null);

  useEffect(() => {
    setRows(readRows());
    setReady(true);
    fetch("/pfs-2026.json")
      .then((response) => (response.ok ? (response.json() as Promise<PfsFile>) : null))
      .then((file) => {
        if (!file) return;
        const locality = file.localities.find((item) => item.mac === "13282" && item.number === "99") ?? null;
        const next: Record<string, number> = {};
        for (const row of file.rows as PfsRow[]) {
          const conversion = conversionFor(row, "nonQp", file);
          if (!conversion) continue;
          const dollars = localityDollars(row, "nf", locality, conversion);
          if (dollars > 0) next[row.c] = dollars;
        }
        setRates(next);
      })
      .catch(() => undefined);
    return () => {
      timeouts.current.forEach((id) => window.clearTimeout(id));
      if (interval.current !== null) window.clearInterval(interval.current);
    };
  }, []);

  useEffect(() => {
    if (ready) writeRows(rows);
  }, [ready, rows]);

  function run() {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    timeouts.current = [];
    if (interval.current !== null) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
    setKept(false);
    setQueued(false);
    setHuman("");
    const first = runLane(note, null, null, rates);
    if (first.text !== note) setNote(first.text);
    setPatches(first.patches);
    setLane(first);
    setBlock(first.block);
    setBoundary(first.boundary);
    if (first.block || first.boundary || first.lines.length === 0) {
      setPhase("idle");
      setStep(-1);
      return;
    }
    const motionOff = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(motionOff);
    if (motionOff) {
      setPhase("done");
      setStep(STEPS.length - 1);
      setElapsed(0);
      return;
    }
    setPhase("running");
    setStep(0);
    setElapsed(0);
    const started = performance.now();
    MARKS_MS.forEach((ms, index) => {
      timeouts.current.push(window.setTimeout(() => setStep(index), ms));
    });
    interval.current = window.setInterval(() => setElapsed(performance.now() - started), 40);
    timeouts.current.push(
      window.setTimeout(() => {
        if (interval.current !== null) {
          window.clearInterval(interval.current);
          interval.current = null;
        }
        const seconds = Math.round((performance.now() - started) / 10) / 100;
        setElapsed(seconds * 1000);
        setLane(runLane(first.text, null, seconds, rates));
        setPhase("done");
      }, DONE_MS),
    );
  }

  function keep() {
    if (!lane || lane.lines.length === 0 || lane.block || lane.proof.status === "stop" || humanBad) return;
    const humanSeconds = human.trim() === "" ? null : Number(human);
    const stamped = new Date().toISOString();
    const sealed = lane.lines.map((line) =>
      sealRow({
        id: crypto.randomUUID(),
        at: stamped,
        span: line.span,
        code: line.code,
        units: line.units,
        allowed: line.allowed,
        scriptSeconds: lane.scriptSeconds,
        humanSeconds,
      }),
    );
    if (sealed.some((row) => row === null)) return;
    setRows((current) => [...sealed.filter((row): row is DeskRow => row !== null), ...current]);
    setKept(true);
    addBoard({
      codes: lane.lines.map((line) => line.code).join(", "),
      scriptSeconds: lane.scriptSeconds,
      humanSeconds,
      allowed: lane.allowed,
      status: "priced",
    });
    for (const line of lane.lines) {
      addGold({ code: line.code, units: line.units, allowed: line.allowed, label: "unlabeled", note: line.span });
    }
  }

  function queueTeam() {
    if (!lane || lane.lines.length === 0 || lane.block) return;
    const packet = makePacket(
      lane.text,
      lane.lines.map((line) => ({ code: line.code, units: line.units, allowed: line.allowed })),
    );
    if (packet.status === "stopped") return;
    writeQueue([packet, ...readQueue()]);
    setQueued(true);
  }

  function sendToWorksheet() {
    if (!lane || lane.lines.length === 0 || lane.block || lane.proof.status === "stop") return;
    const book = readBilling();
    const clientId = book.clients[0]?.id ?? crypto.randomUUID();
    if (book.clients.length === 0) {
      book.clients.push({ id: clientId, name: "Desk draft", npi: "" });
    }
    const claim = {
      id: crypto.randomUUID(),
      clientId,
      dos: "2026-07-01",
      pos: "12",
      diagnosis: "",
      payer: "medicare" as const,
      status: "draft" as const,
      lines: lane.lines.map((line) => ({
        id: crypto.randomUUID(),
        code: line.code,
        modifier: "",
        units: line.units,
        chargeCents: null,
        allowedCents: Math.round(line.allowed * 100),
        schedule: "2026 physician, Rest of New York",
        note: line.span,
      })),
    };
    book.claims = [claim, ...book.claims];
    writeBilling(book);
    setSent(true);
  }

  function download() {
    const file = {
      to: "Kai",
      brief: briefFromRows(rows),
      rows,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lane-leave-behind.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const clock =
    phase === "idle" ? "Not run" : reduced && phase === "done" ? "Not timed" : (elapsed / 1000).toFixed(2);
  const humanBad =
    human.trim() !== "" &&
    (!Number.isFinite(Number(human)) || Number(human) < 0 || Number(human) > 86_400);
  const humanSeconds = human.trim() === "" || humanBad ? null : Number(human);
  const shown = lane ?? { teams: IDLE_TEAMS };

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean · 14760</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Paste the note. It prices for Rest of New York.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Cattaraugus County is locality 99, MAC 13282. Shield scans first. Claims Wedge names the code. CMS Codes checks the Olean rate from the loaded 2026 file. Nothing leaves this browser.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Adult day therapy codes, Rest of New York, 2026 non-facility amount per unit
            </caption>
            <thead className="bg-paper-2 text-xs tracking-widest text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 text-right font-medium">Per unit</th>
              </tr>
            </thead>
            <tbody>
              {SERVICES.map((service) => (
                <tr key={service.code} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink tabular-nums">{service.code}</td>
                  <td className="px-4 py-3 text-ink">{service.name}</td>
                  <td className="px-4 py-3 text-right text-ink tabular-nums">{money(service.unitDollars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          These six rows are what the clock can read from prose. Any other code written in the note is priced from the loaded 2026 physician file when that code is in it.{" "}
          <Link to="/book" className="font-medium text-teal">
            Look up a code.
          </Link>
        </p>

        <ol className="mt-6 grid gap-3 lg:grid-cols-2">
          {shown.teams.map((team) => (
            <li key={team.id} className="rounded-2xl border border-line bg-paper-2 p-4">
              <p className="text-xs font-medium tracking-widest text-teal uppercase">{team.status.replaceAll("-", " ")}</p>
              <h2 className="mt-2 font-display text-2xl text-ink">{team.name}</h2>
              <p className="mt-1 text-xs font-medium text-muted">Lead {team.lead}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink">{team.detail}</p>
              <ul className="mt-3 space-y-1">
                {team.members.map((member) => (
                  <li key={member.role} className="text-sm text-muted">
                    <span className="font-medium text-ink">{member.role}. </span>
                    {member.job}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        {lane ? (
          <section className="mt-6 rounded-2xl border border-line bg-paper-2 p-5">
            <p className="text-xs font-medium tracking-widest text-teal uppercase">{lane.proof.status.replaceAll("-", " ")}</p>
            <h2 className="mt-2 font-display text-3xl text-ink">{lane.proof.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink">{lane.proof.job}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink">{lane.proof.detail}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">Next proof. {lane.proof.nextProof}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">Forbidden. {lane.proof.forbidden}</p>
          </section>
        ) : null}

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
          <div>
            <label htmlFor="note" className="text-sm font-medium text-ink">
              De-identified note
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setBlock(null);
                setKept(false);
              }}
              rows={8}
              className="mt-1.5 w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-base leading-relaxed text-ink"
            />
            <button
              type="button"
              onClick={run}
              disabled={phase === "running"}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep disabled:cursor-default disabled:opacity-60"
            >
              {phase === "running" ? "Running" : "Run this note"}
            </button>
            <p className="mt-1 text-sm text-muted">Every note crosses the base gate before the clock. Markup is stripped. An identifier stops the run.</p>
            {patches.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-deep" role="status">
                {patches.map((patch) => (
                  <li key={patch}>{patch}</li>
                ))}
              </ul>
            ) : null}
            {boundary ? (
              <p className="mt-6 rounded-2xl border border-line bg-paper-2 px-5 py-4 text-base text-ink" role="alert">
                {boundary}
              </p>
            ) : block ? (
              <p className="mt-3 text-sm font-medium text-deep" role="alert">
                {GATE_COPY[block]}
              </p>
            ) : null}
          </div>

          <article className="overflow-hidden rounded-2xl border border-line bg-paper-2">
            <div className="h-1 bg-teal" />
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="text-xs font-medium tracking-widest text-teal uppercase">Script clock</p>
              <p className="font-display text-3xl text-ink tabular-nums" aria-live="polite">
                {phase === "idle" || (reduced && phase === "done") ? (
                  <span className="font-sans text-sm font-medium text-muted">{clock}</span>
                ) : (
                  <>
                    {clock}
                    <span className="ml-1 font-sans text-sm font-medium text-muted">s</span>
                  </>
                )}
              </p>
            </div>
            <ol className="space-y-2 px-5 py-4" aria-label="Run steps">
              {STEPS.map((label, index) => {
                const state = step > index ? "done" : step === index ? "now" : "wait";
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        state === "wait"
                          ? "grid size-6 place-items-center rounded-full border border-line text-xs text-muted tabular-nums"
                          : "grid size-6 place-items-center rounded-full bg-teal text-xs text-teal-ink tabular-nums"
                      }
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className={state === "wait" ? "text-muted" : "text-ink"}>{label}</span>
                  </li>
                );
              })}
            </ol>
            {lane && lane.lines.length > 0 && phase === "done" ? (
              <div className="space-y-4 border-t border-line px-5 py-4">
                <ul className="space-y-3">
                  {lane.lines.map((line) => (
                    <li key={line.code}>
                      <p className="text-sm leading-relaxed text-ink">
                        <span className="font-medium">Span. </span>
                        {line.span}
                      </p>
                      <dl className="mt-2 grid grid-cols-3 gap-3">
                        <div>
                          <dt className="text-xs font-medium tracking-widest text-muted uppercase">Code</dt>
                          <dd className="mt-1 font-medium text-ink tabular-nums">{line.code}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium tracking-widest text-muted uppercase">Units</dt>
                          <dd className="mt-1 font-medium text-ink tabular-nums">{line.units}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium tracking-widest text-muted uppercase">Allowed</dt>
                          <dd className="mt-1 font-medium text-ink tabular-nums">{money(line.allowed)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-muted">
                  Provisional {lane.lines.length === 1 ? money(lane.allowed) : `${money(lane.allowed)} across ${lane.lines.length} codes`}
                  . 2026 non-facility, Rest of New York, MAC 13282, locality 99. Not a payment. Pending a clinician label.
                </p>
                {lane.brief ? (
                  <dl className="grid gap-3 rounded-xl border border-line bg-paper p-4">
                    <div>
                      <dt className="text-xs font-medium tracking-widest text-teal uppercase">Kai brief</dt>
                      <dd className="mt-1 text-sm text-muted">
                        {lane.ship ? "Proof passed this row." : "Proof has not passed a ship."} Not sent anywhere.
                      </dd>
                    </div>
                    {(
                      [
                        ["Wedge", lane.brief.wedge],
                        ["Proof path", lane.brief.proofPath],
                        ["Measured delta", lane.brief.measuredDelta],
                        ["Intel", lane.brief.intel],
                        ["Decision", lane.brief.decision],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs font-medium tracking-widest text-muted uppercase">{label}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <div>
                  <label htmlFor="human" className="text-sm font-medium text-ink">
                    Your seconds on the same note
                  </label>
                  <input
                    id="human"
                    inputMode="decimal"
                    value={human}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHuman(value);
                      setKept(false);
                      if (!lane || lane.lines.length === 0) return;
                      const bad =
                        value.trim() !== "" &&
                        (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 86_400);
                      const seconds = value.trim() === "" || bad ? null : Number(value);
                      setLane(runLane(lane.text, seconds, lane.scriptSeconds, rates));
                    }}
                    placeholder="Blank until you time it"
                    className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
                  />
                  {humanBad ? (
                    <p className="mt-1.5 text-sm font-medium text-deep" role="alert">
                      Enter seconds as a number under a day, or leave it blank.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={keep}
                  disabled={kept || humanBad || lane.proof.status === "stop"}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-muted px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-teal disabled:opacity-60"
                >
                  {kept ? "Row kept" : "Keep this row"}
                </button>
                <button
                  type="button"
                  onClick={sendToWorksheet}
                  disabled={sent || lane.proof.status === "stop"}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep disabled:opacity-60"
                >
                  {sent ? "On the worksheet" : "Send to worksheet"}
                </button>
                {sent ? (
                  <p className="text-sm text-muted">
                    Draft claim is on the{" "}
                    <Link to="/billing" className="font-medium text-teal">
                      billing worksheet
                    </Link>
                    . Not sent anywhere.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={queueTeam}
                  disabled={queued || lane.proof.status === "stop"}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-muted px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-teal disabled:opacity-60"
                >
                  {queued ? "Queued for the team" : "Queue for the team"}
                </button>
                {queued ? (
                  <p className="text-sm text-muted">
                    Cleared packet is on the{" "}
                    <Link to="/team" className="font-medium text-teal">
                      team page
                    </Link>
                    . Not sent.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="border-t border-line px-5 py-4 text-sm text-muted">
                Not run yet. A refused note does not get a code.
              </p>
            )}
          </article>
        </div>

        <section className="mt-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-3xl text-ink">Rows on this browser</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                {rows.length === 0
                  ? "No rows yet. A kept row is the start of the leave-behind."
                  : `${rows.length} kept. Blank human seconds means the desk has not been timed.`}
              </p>
            </div>
            <button
              type="button"
              onClick={download}
              disabled={rows.length === 0}
              className="inline-flex h-11 items-center justify-center rounded-full bg-teal px-4 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep disabled:opacity-60"
            >
              Download the file
            </button>
          </div>
          <ul className="mt-6 space-y-3">
            {rows.map((row) => {
              const delta =
                row.scriptSeconds !== null && row.humanSeconds !== null
                  ? Math.round((row.humanSeconds - row.scriptSeconds) * 100) / 100
                  : null;
              return (
                <li key={row.id} className="rounded-2xl border border-line bg-paper-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed text-ink">{row.span}</p>
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                      className="shrink-0 text-sm font-medium text-muted hover:text-ink"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {row.code} {row.name} · {row.units} unit{row.units === 1 ? "" : "s"} · {money(row.allowed)} provisional ·
                    script {row.scriptSeconds === null ? "not timed" : `${row.scriptSeconds.toFixed(2)}s`} · human{" "}
                    {row.humanSeconds === null ? "blank" : `${row.humanSeconds}s`}
                    {delta === null ? "" : ` · difference ${delta}s on this row`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </Shell>
  );
}

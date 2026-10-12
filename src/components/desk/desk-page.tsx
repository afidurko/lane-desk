import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DeidWarning, Empty, FIELD, LINK, Page, PRIMARY, ReferenceNote, SECONDARY } from "@/components/ui";
import { addToOpenClaim } from "@/lib/billing/store";
import { IS_INTERNAL } from "@/lib/config/mode";
import { money, serviceOf, type Gate } from "@/lib/desk/clock";
import { runLane, type LaneRun } from "@/lib/desk/lane";
import { DEFAULT_SAMPLE, SAMPLES } from "@/lib/demo/samples";
import { formatSeconds, OUR_SIDE_LABEL, timeCoder, type Timing } from "@/lib/demo/timing";
import { DEFAULT_LOCALITY } from "@/lib/config/ny";
import { loadRates, type RateSet } from "@/lib/pricing/rates";

const GATE_COPY: Record<Exclude<Gate, "ok">, string> = {
  empty: "There is no note yet. Pick a sample above or paste a de-identified note.",
  phi: "Refused. The note has something that looks like an identifier, such as a record number, date of birth, phone number, or email. Nothing was priced or kept.",
  oversize: "Refused. The note is longer than the size limit. Nothing was priced or kept.",
  units: "Not priced. Units must be a whole number from 1 to 8, and minutes must agree with units. Under 8 minutes is not a unit.",
  split: "Not priced. Two services are on the same line. Put each service on its own line.",
  "wrong-type":
    "Not priced. This note does not name a therapy service the coder reads, and no listed code is in it. The coder does not guess.",
};

type State = { kind: "idle" } | { kind: "done"; lane: LaneRun; timing: Timing } | { kind: "stopped"; copy: string };

export function DeskPage() {
  const [note, setNote] = useState<string>(DEFAULT_SAMPLE.note);
  const [sampleId, setSampleId] = useState<string | null>(DEFAULT_SAMPLE.id);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [rateSet, setRateSet] = useState<RateSet | null>(null);
  const [locality, setLocality] = useState<string>(DEFAULT_LOCALITY.key);
  const localityId = useId();
  const [loadFailed, setLoadFailed] = useState(false);
  const [human, setHuman] = useState("");
  const [sent, setSent] = useState(false);
  const noteId = useId();
  const humanId = useId();

  useEffect(() => {
    let cancel = false;
    setLoadFailed(false);
    loadRates(locality)
      .then((set) => {
        if (!cancel) setRateSet(set);
      })
      .catch(() => {
        if (!cancel) setLoadFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, [locality]);

  function pick(id: string) {
    const sample = SAMPLES.find((item) => item.id === id);
    if (!sample) return;
    setNote(sample.note);
    setSampleId(id);
    setState({ kind: "idle" });
    setSent(false);
  }

  function run() {
    if (!rateSet) return;
    setSent(false);
    const lane = runLane(note, null, null, rateSet.rates);
    if (lane.block) return setState({ kind: "stopped", copy: GATE_COPY[lane.block] });

    if (lane.boundary) return setState({ kind: "stopped", copy: lane.boundary });
    if (lane.lines.length === 0) return setState({ kind: "stopped", copy: GATE_COPY["wrong-type"] });
    setState({
      kind: "done",
      lane,
      timing: timeCoder(lane.text, rateSet.rates),
    });
  }

  const humanSeconds = human.trim() === "" ? null : Number(human);
  const humanBad = humanSeconds !== null && (!Number.isFinite(humanSeconds) || humanSeconds < 0 || humanSeconds > 86_400);

  function worksheet(lane: LaneRun) {
    for (const line of lane.lines) {
      const separate = serviceOf(line.code)?.separate !== false && line.allowed > 0;
      const cents = separate ? Math.round(line.allowed * 100) : null;
      addToOpenClaim({
        code: line.code,
        modifier: "",
        units: line.units,
        chargeCents: cents,
        allowedCents: cents,
        schedule: `2026 physician, ${rateSet?.scope ?? "New York"}`,
        note: line.span,
        year: 2026,
        claimNote: lane.text,
      });
    }
    setSent(true);
  }

  return (
    <Page
      kicker="Step 1 of 3"
      title="Try a sample note"
      lede="Read a short, made-up therapy note, see the code and the Medicare reference price for it, and see how long the rule-based coder took. The note stays in this browser."
    >
      <section aria-labelledby="samples-h">
        <h2 id="samples-h" className="text-sm font-medium text-ink">
          Pick a sample
        </h2>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="samples-h">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => pick(sample.id)}
              aria-pressed={sampleId === sample.id}
              className={
                sampleId === sample.id
                  ? "h-11 rounded-full border-2 border-teal bg-wash px-4 text-sm font-medium text-ink"
                  : "h-11 rounded-full border border-muted/60 bg-paper-2 px-4 text-sm text-ink hover:border-teal"
              }
            >
              {sample.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{SAMPLES.find((item) => item.id === sampleId)?.why ?? "Your own note."}</p>
      </section>

      <section className="mt-8" aria-labelledby="note-h">
        <h2 id="note-h" className="sr-only">
          The note
        </h2>
        <label htmlFor={noteId} className="text-sm font-medium text-ink">
          De-identified note
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSampleId(null);
            setState({ kind: "idle" });
          }}
          rows={7}
          maxLength={8000}
          aria-describedby={`${noteId}-warn`}
          className={`${FIELD} py-3 leading-relaxed`}
        />
        <DeidWarning id={`${noteId}-warn`} />
        {IS_INTERNAL && rateSet && rateSet.localities.length > 1 ? (
          <div className="mt-4">
            <label htmlFor={localityId} className="text-sm font-medium text-ink">
              New York locality (internal)
            </label>
            <select
              id={localityId}
              value={locality}
              onChange={(event) => {
                setLocality(event.target.value);
                setState({ kind: "idle" });
              }}
              className={`${FIELD} h-12`}
            >
              {rateSet.localities.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button type="button" onClick={run} disabled={!rateSet || note.trim() === ""} className={`${PRIMARY} mt-4 w-full sm:w-auto`}>
          {rateSet ? "Price this note" : loadFailed ? "Fee file did not load" : "Loading the fee file"}
        </button>
        {loadFailed ? (
          <p className="mt-3 text-sm font-medium text-deep" role="alert">
            The 2026 fee file did not load. Reload the page to try again. Nothing was priced.
          </p>
        ) : null}
      </section>

      <section className="mt-10" aria-labelledby="result-h" aria-live="polite">
        <h2 id="result-h" className="font-display text-2xl text-ink">
          Result
        </h2>
        {state.kind === "idle" ? (
          <div className="mt-3">
            <Empty>Nothing has run yet. Choose “Price this note”. The result, the price, and the timing appear here.</Empty>
          </div>
        ) : null}
        {state.kind === "stopped" ? (
          <p className="mt-3 rounded-2xl border border-deep/40 bg-paper-2 px-4 py-4 text-sm leading-relaxed text-ink" role="alert">
            {state.copy}
          </p>
        ) : null}
        {state.kind === "done" ? (
          <div className="mt-3 space-y-6">
            <div className="overflow-x-auto rounded-2xl border border-line bg-paper-2">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">Codes found in the note and their Medicare reference price</caption>
                <thead>
                  <tr className="border-b border-line text-xs tracking-widest text-muted uppercase">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Service
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Units
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Reference price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.lane.lines.map((line) => {
                    const none = line.allowed === 0;
                    return (
                      <tr key={line.code} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-medium text-ink tabular-nums">{line.code}</td>
                        <td className="px-4 py-3 text-ink">{rateSet?.names.get(line.code) ?? line.name}</td>
                        <td className="px-4 py-3 text-ink tabular-nums">{line.units}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink tabular-nums">
                          {none ? "No separate amount" : money(line.allowed)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {state.lane.lines.length > 1 ? (
                  <tfoot>
                    <tr className="border-t border-line">
                      <th scope="row" colSpan={3} className="px-4 py-3 text-left font-medium text-ink">
                        Total of these lines
                      </th>
                      <td className="px-4 py-3 text-right font-medium text-ink tabular-nums">{money(state.lane.allowed)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <div>
              <ReferenceNote scope={false} />
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {rateSet?.scope}. PACE is capitated, so this is a check figure, not what anyone is paid.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Provisional until a clinician reviews the code. Every price is the loaded CMS file ({rateSet?.release}) amount for that
                code.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2" aria-labelledby="time-h" role="group">
              <h3 id="time-h" className="sr-only">
                Timing
              </h3>
              <div className="rounded-2xl border border-line bg-paper-2 p-4">
                <p className="text-xs font-medium tracking-widest text-teal uppercase">{OUR_SIDE_LABEL}</p>
                <p className="mt-2 font-display text-2xl text-ink tabular-nums">{formatSeconds(state.timing.seconds)}</p>
                <p className="mt-1 text-sm text-muted">per note on this note, average of {state.timing.runs} runs in this browser.</p>
              </div>
              <div className="rounded-2xl border border-line bg-paper-2 p-4">
                <p className="text-xs font-medium tracking-widest text-muted uppercase">Manual desk</p>
                <p className="mt-2 font-display text-2xl text-ink">
                  {humanSeconds !== null && !humanBad ? `${humanSeconds} seconds` : "Not yet timed"}
                </p>
                <label htmlFor={humanId} className="mt-1 block text-sm text-muted">
                  Optional: time your own desk on this note and enter the seconds. It is your stopwatch, not our measurement.
                </label>
                <input
                  id={humanId}
                  inputMode="decimal"
                  value={human}
                  onChange={(event) => setHuman(event.target.value)}
                  aria-invalid={humanBad}
                  className={`${FIELD} mt-2 h-11`}
                />
                {humanBad ? (
                  <p className="mt-1.5 text-sm font-medium text-deep" role="alert">
                    Enter seconds as a number under a day, or leave it blank.
                  </p>
                ) : null}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              We make no claim about time saved. The manual side stays blank until a real desk is timed on the same notes.
            </p>

            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
              <Link to="/invoice" className={LINK}>
                Next: check an invoice
              </Link>
              {IS_INTERNAL ? (
                <button type="button" className={SECONDARY} onClick={() => worksheet(state.lane)} disabled={sent}>
                  {sent ? "On the claim worksheet" : "Send to the claim worksheet (internal)"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </Page>
  );
}

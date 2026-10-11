import { useEffect, useRef, useState } from "react";

const SAMPLE_NOTE = `Participant, 78. Adult day health. Not a real person.
Therapeutic exercise, supervised, 15 minutes. One unit.
Gait and balance. No new pain reported.
Plan: continue therapeutic exercise next session.`;

const STEPS = [
  { key: "read", label: "Read the note" },
  { key: "code", label: "Assign a code" },
  { key: "price", label: "Price the allowed amount" },
  { key: "audit", label: "Tie the line to the note" },
] as const;

const MARKS_MS = [420, 980, 1540, 2100];
const DONE_MS = 2300;

type Phase = "idle" | "running" | "done";

export function Instrument() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(false);
  const timeouts = useRef<number[]>([]);
  const interval = useRef<number | null>(null);

  function clearTimers() {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    timeouts.current = [];
    if (interval.current !== null) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
  }

  useEffect(() => () => clearTimers(), []);

  function run() {
    clearTimers();
    const motionOff = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(motionOff);
    if (motionOff) {
      setStep(STEPS.length - 1);
      setElapsed(0);
      setPhase("done");
      return;
    }
    setPhase("running");
    setStep(0);
    setElapsed(0);
    const started = performance.now();
    MARKS_MS.forEach((ms, index) => {
      const id = window.setTimeout(() => setStep(index), ms);
      timeouts.current.push(id);
    });
    interval.current = window.setInterval(() => {
      setElapsed(performance.now() - started);
    }, 40);
    const finish = window.setTimeout(() => {
      if (interval.current !== null) {
        window.clearInterval(interval.current);
        interval.current = null;
      }
      setElapsed(performance.now() - started);
      setPhase("done");
    }, DONE_MS);
    timeouts.current.push(finish);
  }

  const showSample = phase === "done";
  const clockText =
    phase === "idle" ? "Not run" : reduced && phase === "done" ? "—" : (elapsed / 1000).toFixed(2);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-sm">
      <div className="h-1 bg-teal" />
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-teal uppercase">Sample note</p>
          <p className="text-sm text-muted">De-identified. Not a participant.</p>
        </div>
        <p className="font-display text-3xl text-ink tabular-nums" aria-live="polite">
          <span className="sr-only">Script clock </span>
          {phase === "idle" ? (
            <span className="font-sans text-sm font-medium text-muted">{clockText}</span>
          ) : (
            <>
              {clockText}
              <span className="ml-1 font-sans text-sm font-medium text-muted">s</span>
            </>
          )}
        </p>
      </div>

      <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-ink">{SAMPLE_NOTE}</p>

      <ol className="space-y-2 px-5" aria-label="Run steps">
        {STEPS.map((item, index) => {
          const state = step > index ? "done" : step === index ? "now" : "wait";
          return (
            <li key={item.key} className="flex items-center gap-3 text-sm">
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
              <span className={state === "wait" ? "text-muted" : "text-ink"}>
                {item.label}
                {state === "now" && phase === "running" ? (
                  <span className="sr-only">, in progress</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={run}
          disabled={phase === "running"}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep disabled:cursor-default disabled:opacity-60"
        >
          {phase === "running" ? "Running" : phase === "done" ? "Run the sample again" : "Run this sample"}
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-3">
        <div className="bg-paper-2 px-5 py-4">
          <dt className="text-xs font-medium tracking-widest text-muted uppercase">Code</dt>
          <dd className="mt-2 text-sm text-ink">
            {showSample ? (
              <span className="flex flex-wrap gap-1.5">
                {["97110"].map((code) => (
                  <span key={code} className="rounded-md bg-wash px-2 py-1 font-medium text-deep tabular-nums">
                    {code}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted">Not run yet</span>
            )}
          </dd>
        </div>
        <div className="bg-paper-2 px-5 py-4">
          <dt className="text-xs font-medium tracking-widest text-muted uppercase">Allowed</dt>
          <dd className="mt-2 font-medium text-ink tabular-nums">
            {showSample ? "$28.27" : <span className="font-normal text-muted">Not run yet</span>}
          </dd>
        </div>
        <div className="bg-paper-2 px-5 py-4">
          <dt className="text-xs font-medium tracking-widest text-muted uppercase">Human desk</dt>
          <dd className="mt-2 text-sm text-ink">Not timed. Bring the same encounter.</dd>
        </div>
      </dl>

      <p className="px-5 py-4 text-xs leading-relaxed text-muted">
        {showSample
          ? "2026 non-facility amount for 97110, one unit, Rest of New York (MAC 13282, locality 99). Not a payment. Not for billing. Pending a clinician label. "
          : "Not run yet. The button fills the code and the allowed amount. "}
        {reduced && phase === "done"
          ? "Motion is reduced, so the sample appears without a performed time. "
          : null}
        A real delta is manual seconds against script seconds. This page does not invent one.{" "}
        <a href="/run" className="font-medium text-teal hover:text-deep">
          See the sample file.
        </a>{" "}
        <a href="/desk" className="font-medium text-teal hover:text-deep">
          Open it on the desk.
        </a>
      </p>
    </div>
  );
}

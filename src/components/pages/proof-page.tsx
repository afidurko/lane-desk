import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Empty, LINK, Page, PRIMARY, ReferenceNote } from "@/components/ui";
import { IS_INTERNAL } from "@/lib/config/mode";
import { PROOF_NOTES } from "@/lib/demo/samples";
import { formatSeconds, OUR_SIDE_LABEL, timeCoder, RUNS } from "@/lib/demo/timing";
import { loadRates } from "@/lib/pricing/rates";

type Year = { year: number; release: string; conversionFactor: string; codesChecked: number; codesPriced: number; mismatches: number };
type ProofFile = {
  generated: string;
  years: Year[];
  negativeControlCaught: boolean;
  totals: { years: number; codesChecked: number; mismatches: number };
};
type Internal = {
  years: { year: number; codesChecked: number; mismatches: number }[];
  therapyTable: { codes: number; mismatches: number };
};

type Timed = { perNote: number; slowest: number; notes: number };

export function ProofPage() {
  const [proof, setProof] = useState<ProofFile | null>(null);
  const [internal, setInternal] = useState<Internal | null>(null);
  const [failed, setFailed] = useState(false);
  const [timed, setTimed] = useState<Timed | null>(null);
  const [busy, setBusy] = useState(false);
  const [timeFailed, setTimeFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/proof.json")
      .then((response) => (response.ok ? (response.json() as Promise<ProofFile>) : Promise.reject(new Error("missing"))))
      .then((file) => !cancel && setProof(file))
      .catch(() => !cancel && setFailed(true));
    if (IS_INTERNAL) {
      fetch("/proof-internal.json")
        .then((response) => (response.ok ? (response.json() as Promise<Internal>) : null))
        .then((file) => !cancel && file && setInternal(file))
        .catch(() => undefined);
    }
    return () => {
      cancel = true;
    };
  }, []);

  async function measure() {
    setBusy(true);
    setTimeFailed(false);
    try {
      const { rates } = await loadRates();
      const each = PROOF_NOTES.map((note) => timeCoder(note, rates).seconds);
      setTimed({ perNote: each.reduce((a, b) => a + b, 0) / each.length, slowest: Math.max(...each), notes: each.length });
    } catch {
      setTimed(null);
      setTimeFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      kicker="Proof"
      title="The prices match the CMS files, year by year"
      lede="This page shows what has been checked and what has not. The claim is about prices, not speed."
    >
      <section aria-labelledby="price-h">
        <h2 id="price-h" className="font-display text-2xl text-ink">
          1. Price check
        </h2>
        {failed ? (
          <p className="mt-3 text-sm font-medium text-deep" role="alert">
            The proof file did not load. Reload the page. Nothing on this page is shown from memory.
          </p>
        ) : null}
        {!proof && !failed ? <p className="mt-3 text-sm text-muted">Loading the proof file.</p> : null}
        {proof ? (
          <>
            <p className="mt-3 text-lg leading-relaxed text-ink">
              {proof.totals.codesChecked.toLocaleString("en-US")} payable codes were recomputed across {proof.totals.years} fee schedule
              years (2020 to 2026).{" "}
              <strong className="font-medium">
                {proof.totals.mismatches === 0
                  ? "None differed from what the app shows."
                  : `${proof.totals.mismatches} differed. They are listed in the file.`}
              </strong>
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper-2">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <caption className="sr-only">Price check by fee schedule year</caption>
                <thead>
                  <tr className="border-b border-line text-xs tracking-widest text-muted uppercase">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Year
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      CMS file
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Codes checked
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Different
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proof.years.map((year) => (
                    <tr key={year.year} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-medium text-ink tabular-nums">{year.year}</td>
                      <td className="px-4 py-2.5 text-ink">{year.release}</td>
                      <td className="px-4 py-2.5 text-right text-ink tabular-nums">{year.codesChecked.toLocaleString("en-US")}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-ink tabular-nums">{year.mismatches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              How: each price is the file&rsquo;s non-facility total times that year&rsquo;s conversion factor. The check rebuilds the same
              price from the file&rsquo;s separate work, practice expense, and malpractice values and compares to the cent.{" "}
              {proof.negativeControlCaught
                ? "A price changed by one cent on purpose was caught, so the check can fail."
                : "The deliberate-error control was not caught. Treat this check as unproven."}{" "}
              Checked on {proof.generated}. It proves the arithmetic against the loaded files. It does not prove CMS is right, and it does
              not say what any plan pays.
            </p>
            <ReferenceNote />
          </>
        ) : null}
        {IS_INTERNAL && internal ? (
          <p className="mt-4 rounded-2xl border border-line bg-wash px-4 py-3 text-sm leading-relaxed text-ink">
            Internal only. Rest of New York, locality 99: {internal.years.reduce((n, y) => n + y.codesChecked, 0).toLocaleString("en-US")}{" "}
            prices checked across the year files, {internal.years.reduce((n, y) => n + y.mismatches, 0)} different. The typed-in therapy
            table ({internal.therapyTable.codes} codes) has {internal.therapyTable.mismatches} different from the 2026 file.
          </p>
        ) : null}
      </section>

      <section className="mt-12" aria-labelledby="time-h">
        <h2 id="time-h" className="font-display text-2xl text-ink">
          2. How long the coder takes
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Run the rule-based coder here, in your browser, over {PROOF_NOTES.length} short synthetic notes. Each note is read {RUNS} times
          and averaged. Nothing is staged.
        </p>
        <button type="button" onClick={measure} disabled={busy} className={`${PRIMARY} mt-4`}>
          {busy ? "Timing" : timed ? "Run the timing again" : "Run the timing"}
        </button>
        <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite">
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <p className="text-xs font-medium tracking-widest text-teal uppercase">{OUR_SIDE_LABEL}</p>
            {timed ? (
              <>
                <p className="mt-2 font-display text-3xl text-ink tabular-nums">{formatSeconds(timed.perNote)}</p>
                <p className="mt-1 text-sm text-muted">
                  per note, average over {timed.notes} notes. Slowest note: {formatSeconds(timed.slowest)}.
                </p>
              </>
            ) : (
              <div className="mt-2">
                <Empty>Not run yet.</Empty>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">Manual desk</p>
            <p className="mt-2 font-display text-3xl text-ink">Not yet timed</p>
            <p className="mt-1 text-sm text-muted">No one has timed a desk on these notes, so there is nothing to compare.</p>
          </div>
        </div>
        {timeFailed ? (
          <p className="mt-3 text-sm font-medium text-deep" role="alert">
            The fee file did not load, so the coder could not run. Reload and try again.
          </p>
        ) : null}
      </section>

      <section className="mt-12" aria-labelledby="not-h">
        <h2 id="not-h" className="font-display text-2xl text-ink">
          3. Not proven yet
        </h2>
        <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink">
          <li className="flex gap-3">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
            Time saved against a manual desk. That needs a real desk timed on the same notes.
          </li>
          <li className="flex gap-3">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
            Coding accuracy on real notes. Codes stay provisional until a clinician reviews them.
          </li>
          <li className="flex gap-3">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
            Any dollar savings. PACE is capitated, so a reference price is not a payment.
          </li>
        </ul>
        <p className="mt-8 border-t border-line pt-5">
          <Link to="/about" className={LINK}>
            Read what this is and is not
          </Link>
        </p>
      </section>
    </Page>
  );
}

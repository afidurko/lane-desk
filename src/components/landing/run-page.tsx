import { Link } from "@tanstack/react-router";
import { Shell } from "./shell";

const ROWS = [
  { field: "Encounter", script: "Adult day therapeutic exercise", human: "Same note" },
  { field: "Code", script: "97110", human: "Blank" },
  { field: "Units", script: "1", human: "Blank" },
  { field: "Allowed", script: "$28.27 provisional", human: "Blank" },
  { field: "Seconds", script: "Not measured", human: "Not measured" },
  { field: "Label", script: "Pending a clinician", human: "Blank" },
  { field: "Mismatch", script: "None recorded", human: "Blank" },
] as const;

export function RunPage() {
  return (
    <Shell>
      <main>
        <section className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
          <p className="text-[13px] text-muted">Sample file</p>
          <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">
            One note. Script side filled. Human side blank.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            This is the shape of a leave-behind for the first clock. The note is fictional. Nothing here was timed
            against a person, and nothing here is a bill.
          </p>

          <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-[10px] bg-paper-2">
              <div className="h-1 bg-teal" />
              <div className="border-b border-line px-5 py-4">
                <p className="text-[13px] text-muted">The note</p>
                <p className="text-sm text-muted">De-identified. Not a participant.</p>
              </div>
              <p className="px-5 py-5 text-sm leading-relaxed text-ink">
                Participant, 78. Adult day health. Not a real person.
                <br />
                <mark className="rounded bg-wash px-1 text-deep">
                  Therapeutic exercise, supervised, 15 minutes.
                </mark>{" "}
                One unit.
                <br />
                Gait and balance. No new pain reported.
                <br />
                Plan: continue therapeutic exercise next session.
              </p>
              <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-muted">
                The marked line is the span the code is tied to. A disagreement has to point at a line like this.
              </p>
            </article>

            <article className="rounded-2xl border border-teal bg-wash p-6">
              <p className="text-[13px] text-deep">Script side</p>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-[13px] text-muted">Code</dt>
                  <dd className="mt-1 text-[22px] font-semibold tracking-tight text-ink tabular-nums">97110</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-muted">Allowed</dt>
                  <dd className="mt-1 text-[22px] font-semibold tracking-tight text-ink tabular-nums">$28.27</dd>
                  <dd className="mt-1 text-sm text-muted">
                    2026 non-facility, one unit, Rest of New York. MAC 13282, locality 99. Not a payment.
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] text-muted">Label</dt>
                  <dd className="mt-1 text-sm text-ink">Pending a clinician. Not a gold row yet.</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <section className="border-t border-line bg-paper-2">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">The row the file would carry</h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Script and human desk sit on the same row. Blank means the desk has not been timed. It does not mean
              zero.
            </p>
            <div className="mt-8 overflow-hidden rounded-[10px] bg-paper-2 bg-paper">
              <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] border-b border-line bg-paper-2 px-4 py-3 text-[13px] text-muted">
                <span>Field</span>
                <span>Script</span>
                <span>Human desk</span>
              </div>
              {ROWS.map((row) => (
                <div
                  key={row.field}
                  className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] gap-2 border-b border-line px-4 py-4 text-sm last:border-b-0"
                >
                  <span className="font-medium text-ink">{row.field}</span>
                  <span className="text-ink">{row.script}</span>
                  <span className="text-muted">{row.human}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className="text-[22px] font-semibold tracking-tight text-ink">What this file will not say</h2>
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted">
                <li>No name, record number, or date that identifies a person.</li>
                <li>No portal, no scrape, no second chart.</li>
                <li>No seconds saved, and no dollars recovered.</li>
                <li>No code off the adult-day therapy schedule until this file has a measured clock.</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-ink px-6 py-8 text-paper">
              <h2 className="text-[22px] font-semibold tracking-tight text-ink">Bring the same note.</h2>
              <p className="mt-3 text-sm leading-relaxed text-paper/80">
                The human column stays blank until your desk times this encounter. The list is a request. Nothing is
                sent from the browser except what you choose to type, and that stays on this device.
              </p>
              <Link
                to="/desk"
                className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-paper px-5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-wash"
              >
                Time this note on the desk
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}

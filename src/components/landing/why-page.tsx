import { Ban, CircleDollarSign, Clock3, FileText, Link2, ScrollText, Timer } from "lucide-react";
import { Instrument } from "./instrument";
import { Shell } from "./shell";

const FEATURES = [
  {
    icon: FileText,
    title: "Text in. Nothing else.",
    body: "A de-identified encounter arrives as text. No chart login, no portal, no live PHI on the wire.",
  },
  {
    icon: ScrollText,
    title: "A code, with the span.",
    body: "The code comes back attached to the part of the note that produced it. Disagreements have a reason.",
  },
  {
    icon: CircleDollarSign,
    title: "Allowed dollars beside it.",
    body: "Fee-schedule payment sits on the same line as the code. The clerk’s queue is the cost you are timing.",
  },
  {
    icon: Timer,
    title: "A clock, not a vibe.",
    body: "Script seconds against a human baseline on the same encounter type. No demo ships if it cannot be timed.",
  },
  {
    icon: Link2,
    title: "An audit line on the note.",
    body: "Every output stays tied to the note. The wrap is a record of the work, not a login with headcount behind it.",
  },
  {
    icon: Clock3,
    title: "A weekly leave-behind.",
    body: "What was coded. What was priced. What the desk left on the table. The file cites the run, not a target.",
  },
] as const;

const KILLED = ["Live PHI", "Chart replacement", "Portal login or scrape", "An untimed demo"] as const;

const STEPS = [
  {
    n: "01",
    title: "Write the gold row first.",
    body: "The first schedule is adult-day therapy. Six timed codes, national amounts. The row exists before anyone labels it.",
  },
  {
    n: "02",
    title: "Time both desks.",
    body: "Manual seconds, script seconds, the code, the allowed dollars, and why they mismatch. Twenty to fifty rows.",
  },
  {
    n: "03",
    title: "Leave the file. Leave the chart.",
    body: "A weekly record of what was coded, priced, and left on the table. The chart never moves.",
  },
] as const;

const VOICES = [
  {
    quote: "Code the same note twice, and show the reason when the two desks disagree.",
    role: "Coding",
    seat: "Question, not a quote",
  },
  {
    quote: "Show the dollars the current desk leaves on the table. Weekly. On our claims.",
    role: "Finance",
    seat: "Question, not a quote",
  },
  {
    quote: "Labels come from our clinicians. Do not invent a gold set and call the score accuracy.",
    role: "Clinical",
    seat: "Question, not a quote",
  },
] as const;

export function WhyPage() {
  return (
    <Shell>
      <main>
        <section className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
          <p className="text-xs font-medium tracking-widest text-teal uppercase">Layer 01 · Why</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Win the desk. Leave the chart where it is.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Lock-in lives in the record. The cost structure is the coder and the fee-schedule clerk. Lane attacks
            that cost. The clock reads the adult-day therapy note. The code book holds the full physician, lab,
            ambulance, and equipment files from 2020 through 2026.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-line bg-paper-2 p-6">
              <h2 className="font-display text-2xl text-ink">The desk you already staff</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                <li>A person reads the note.</li>
                <li>A person assigns the code.</li>
                <li>A person prices the allowed amount.</li>
                <li>The chart is the system of record, and it should stay that way.</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-teal bg-wash p-6">
              <h2 className="font-display text-2xl text-deep">Lane, in parallel</h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink">
                <li>The same note, de-identified, as text.</li>
                <li>A code and an allowed amount, with the span.</li>
                <li>Script seconds you can put next to manual seconds.</li>
                <li>No second chart. No portal. No rip-out.</li>
              </ul>
            </article>
          </div>
          <div className="mt-10">
            <Instrument />
          </div>
        </section>

        <section className="border-t border-line bg-paper-2">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <h2 className="max-w-3xl font-display text-3xl text-ink sm:text-5xl">
              Six codes from prose. The full file behind them. Then a number.
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="rounded-2xl border border-line bg-paper p-6">
                  <p className="font-display text-sm text-teal tabular-nums">{step.n}</p>
                  <h3 className="mt-3 font-display text-2xl text-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <h2 className="max-w-3xl font-display text-3xl text-ink sm:text-5xl">Six things the clock is allowed to do.</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-2xl border border-line bg-paper-2 p-6">
                    <span className="grid size-11 place-items-center rounded-xl bg-wash text-teal">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-display text-2xl text-ink">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-8 rounded-2xl border border-line px-5 py-5">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Ban className="size-4 text-teal" aria-hidden="true" />
                Killed on purpose
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {KILLED.map((item) => (
                  <li key={item} className="rounded-xl bg-paper-2 px-3 py-3 text-sm text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-paper-2">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-24">
            <h2 className="max-w-3xl font-display text-3xl text-ink sm:text-5xl">What the room asks before a clock.</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
              These are the questions. They are not quotes, and they are not a pilot result.
            </p>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {VOICES.map((voice) => (
                <figure key={voice.role} className="flex flex-col rounded-2xl border border-line bg-paper p-6">
                  <blockquote className="flex-1 font-display text-xl leading-snug text-ink">{voice.quote}</blockquote>
                  <figcaption className="mt-6 border-t border-line pt-4">
                    <p className="text-sm font-medium text-ink">{voice.role}</p>
                    <p className="text-sm text-muted">{voice.seat}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}

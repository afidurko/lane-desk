import { Link } from "@tanstack/react-router";
import { LINK, Page, PRIMARY } from "@/components/ui";

const STEPS = [
  {
    n: "1",
    title: "Try a sample note",
    body: "Read a made-up therapy note. See the code and the Medicare reference price for it.",
    to: "/desk",
  },
  {
    n: "2",
    title: "Check an invoice",
    body: "Paste invoice lines. See which ones match the reference price for their year.",
    to: "/invoice",
  },
  { n: "3", title: "Request a pilot", body: "Ask for a pilot or an invoice. Nothing is charged or sent from this page.", to: "/request" },
] as const;

export function HomePage() {
  return (
    <Page
      kicker="New York · Medicare reference prices"
      title="Check a therapy note or an invoice against the Medicare fee schedule."
      lede="For PACE teams who review vendor bills and encounter data. Lane reads a de-identified note, names the code, and shows the Medicare reference price from the loaded CMS file."
    >
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/desk" className={PRIMARY}>
          Try a sample note
        </Link>
        <Link to="/about" className={LINK}>
          What this is, and is not
        </Link>
      </div>

      <ol className="mt-12 space-y-4" aria-label="The three steps">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-4 rounded-2xl border border-line bg-paper-2 p-5">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full bg-teal text-sm font-medium text-teal-ink tabular-nums"
              aria-hidden="true"
            >
              {step.n}
            </span>
            <div>
              <h2 className="font-display text-xl text-ink">{step.title}</h2>
              <p className="mt-1 text-base leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12 rounded-2xl border border-line bg-wash p-5" aria-labelledby="not-h">
        <h2 id="not-h" className="font-display text-xl text-ink">
          Read this first
        </h2>
        <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink">
          <li>A price here is a Medicare reference price, not a payment. PACE is capitated.</li>
          <li>This is not an EHR. The chart stays where it is.</li>
          <li>De-identified only. Do not enter patient information.</li>
          <li>Codes are provisional until a clinician reviews them.</li>
        </ul>
      </section>
    </Page>
  );
}

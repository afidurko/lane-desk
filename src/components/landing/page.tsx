import { Link } from "@tanstack/react-router";
import { Shell } from "./shell";

const STEPS = [
  {
    n: "1",
    title: "Price a note",
    body: "Paste a de-identified note. The desk names the code and the Olean rate.",
    to: "/desk",
  },
  {
    n: "2",
    title: "Check a code",
    body: "Look up any code on the Rest of New York file. Change locality only if the service was somewhere else.",
    to: "/book",
  },
  {
    n: "3",
    title: "Build the claim",
    body: "Import an invoice file or open a worksheet. Fix any high alert. Save the submitter. Download the packet.",
    to: "/billing",
  },
] as const;

export function LandingPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean, NY 14760</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-6xl">
          Code the note.
          <span className="block text-teal">Price it for Olean.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Cattaraugus County is Rest of New York: MAC 13282, locality 99. Start with a note, a code, or an invoice. The claim is ready when the packet says so.
        </p>
        <Link to="/desk" className="mt-8 inline-flex h-12 items-center rounded-full bg-teal px-6 text-sm font-medium text-teal-ink">
          Start with a note
        </Link>

        <ol className="mt-12 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.to}>
              <Link to={step.to} className="block h-full rounded-2xl border border-line bg-paper-2 p-5 hover:border-teal">
                <p className="text-xs font-medium tracking-widest text-teal uppercase">Step {step.n}</p>
                <h2 className="mt-2 font-display text-2xl text-ink">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </Link>
            </li>
          ))}
        </ol>

        <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-line pt-6">
          <div>
            <dt className="font-display text-3xl text-ink tabular-nums">14760</dt>
            <dd className="mt-1 text-sm text-muted">Olean, Cattaraugus County</dd>
          </div>
          <div>
            <dt className="font-display text-3xl text-ink tabular-nums">99</dt>
            <dd className="mt-1 text-sm text-muted">locality, Rest of New York</dd>
          </div>
          <div>
            <dt className="font-display text-3xl text-ink tabular-nums">13282</dt>
            <dd className="mt-1 text-sm text-muted">MAC, National Government Services</dd>
          </div>
        </dl>
      </main>
    </Shell>
  );
}

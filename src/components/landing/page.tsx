import { Link } from "@tanstack/react-router";
import { InvoiceCheck } from "@/components/lookup/invoice-check";
import { DESKS } from "@/lib/team/desks";
import { Shell } from "./shell";

export function LandingPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean, New York</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">Four teams. One bill.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          Intake reads it. Price finds the year. New York holds Olean and Allegany. Review marks what does not match. A person decides. Nothing is sent.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {DESKS.map((desk, index) => (
            <li key={desk.id} className="rounded-2xl border border-line p-5">
              <p className="text-xs font-medium tracking-widest text-teal uppercase">Team {index + 1}</p>
              <h2 className="mt-1 font-display text-3xl text-ink">{desk.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink">{desk.does}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{desk.doesNot}</p>
              <Link
                to={desk.href}
                hash={desk.hash}
                className="mt-4 inline-flex h-11 items-center text-sm font-medium text-teal"
              >
                Open {desk.name}
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
          This is not a payer. It does not submit a claim, and it does not have a monthly program payment. Those stay with the program.
        </p>
        <section id="intake" className="mt-12 max-w-xl scroll-mt-28">
          <p className="text-xs font-medium tracking-widest text-teal uppercase">Intake team</p>
          <h2 className="mt-2 font-display text-3xl text-ink">The bill.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">One line for each service. Code, date, and charge.</p>
          <div className="mt-4">
            <InvoiceCheck />
          </div>
        </section>
      </main>
    </Shell>
  );
}

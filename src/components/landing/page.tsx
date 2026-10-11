import { Link } from "@tanstack/react-router";
import { Shell } from "./shell";

const LAYERS = [
  {
    n: "01",
    title: "Why",
    body: "The chart stays. The cost is the coder and the fee-schedule clerk.",
    to: "/why",
    className: "relative z-30 border-line bg-paper-2 text-ink",
    offset: "",
  },
  {
    n: "02",
    title: "Desk",
    body: "Paste one de-identified note. Shield, Claims Wedge, and CMS Codes price it or they stop.",
    to: "/desk",
    className: "relative z-20 border-teal bg-wash text-ink",
    offset: "ml-3 sm:ml-10",
  },
  {
    n: "03",
    title: "File",
    body: "One row. Script side filled. Human side blank until you time the same note.",
    to: "/run",
    className: "relative z-10 border-ink bg-ink text-paper",
    offset: "ml-6 sm:ml-20",
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
          You are in Cattaraugus County. That is Rest of New York: MAC 13282, locality 99. This desk prices the note and builds the claim a PACE program currently staffs with people.
        </p>

        <div className="mt-12">
          {LAYERS.map((layer) => (
            <Link
              key={layer.to}
              to={layer.to}
              className={`-mt-8 block rounded-2xl border p-6 shadow-sm transition-transform duration-200 first:mt-0 hover:-translate-y-1 ${layer.offset} ${layer.className}`}
            >
              <p className="text-xs font-medium tracking-widest uppercase opacity-70">{layer.n}</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl sm:text-4xl">{layer.title}</h2>
                  <p className={`mt-2 max-w-lg text-sm leading-relaxed ${layer.to === "/run" ? "text-paper/80" : "text-muted"}`}>
                    {layer.body}
                  </p>
                </div>
                <span className="hidden shrink-0 text-sm font-medium sm:inline">Open</span>
              </div>
            </Link>
          ))}
        </div>

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

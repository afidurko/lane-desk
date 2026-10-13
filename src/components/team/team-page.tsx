import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { money } from "@/lib/desk/clock";
import { readGold, type GoldRow } from "@/lib/team/gold";
import { readQueue, type Packet } from "@/lib/team/protocol";
import { DESKS } from "@/lib/team/desks";
import { readBoard, type BoardRow } from "@/lib/team/scoreboard";
import { UPDATES } from "@/lib/team/updates";

type Findings = {
  source: string;
  note: string;
  physician: { code: string; name: string; year: number; locality: string; cents: number; source: string }[];
  lab: { code: string; name: string; year: number; cents: number; source: string }[];
  hospice: { name: string; year: string; cents: number | null; index?: number; source: string }[];
  pace: { name: string; year: number; cents: number; source: string }[];
  mue: { code: string; limit: number; unit: string; span: string; source: string }[];
  blocked: string[];
};

export function TeamPage() {
  const [queue, setQueue] = useState<Packet[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [gold, setGold] = useState<GoldRow[]>([]);
  const [findings, setFindings] = useState<Findings | null>(null);

  useEffect(() => {
    setQueue(readQueue());
    setBoard(readBoard());
    setGold(readGold());
    fetch("/team-findings.json")
      .then((response) => (response.ok ? (response.json() as Promise<Findings>) : null))
      .then((file) => setFindings(file))
      .catch(() => undefined);
  }, []);

  const labeled = gold.filter((row) => row.label !== "unlabeled").length;
  const dollars = (cents: number | null) => (cents == null ? "n/a" : money(cents / 100));

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Team</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          The same four teams.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Intake, Price, New York, and Review. A bill stops at Review. Nothing is submitted.
        </p>
        <ol className="mt-8 grid gap-3 lg:grid-cols-2">
          {DESKS.map((desk) => (
            <li key={desk.id} className="rounded-2xl border border-line bg-paper-2 p-4">
              <h2 className="font-display text-2xl text-ink">{desk.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink">{desk.does}</p>
              <p className="mt-2 text-sm text-muted">{desk.doesNot}</p>
            </li>
          ))}
        </ol>

        <section className="mt-10">
          <h2 className="font-display text-3xl text-ink">What the team already verified</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {findings?.source ?? "Loading."} {findings?.note}
          </p>
          {findings ? (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium tracking-widest text-teal uppercase">Physician and lab</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {findings.physician.map((row) => (
                    <li key={`${row.code}-${row.year}`}>{row.code} {row.name}, {row.year}, {row.locality}: {dollars(row.cents)}</li>
                  ))}
                  {findings.lab.map((row) => (
                    <li key={row.code}>{row.code} {row.name}, {row.year}: {dollars(row.cents)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium tracking-widest text-teal uppercase">Hospice</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {findings.hospice.map((row) => (
                    <li key={`${row.name}-${row.year}`}>{row.year}. {row.name}: {row.index != null ? row.index : dollars(row.cents)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium tracking-widest text-teal uppercase">PACE capitation, Medicare A/B</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {findings.pace.map((row) => (
                    <li key={`${row.name}-${row.year}`}>{row.year}. {row.name}: {dollars(row.cents)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium tracking-widest text-teal uppercase">Unit limits</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink">
                  {findings.mue.map((row) => (
                    <li key={row.code}>{row.code}: {row.limit} {row.unit}, {row.span}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium tracking-widest text-teal uppercase">Blocked</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {findings.blocked.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl text-ink">Queued for the team</h2>
          <ul className="mt-4 space-y-2">
            {queue.length === 0 ? <li className="text-sm text-muted">No packet is waiting.</li> : null}
            {queue.map((packet) => (
              <li key={packet.id} className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">
                {packet.status}. {packet.reason} {packet.codes.map((line) => line.code).join(", ")}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl text-ink">Scoreboard</h2>
          <ul className="mt-4 space-y-2">
            {board.length === 0 ? <li className="text-sm text-muted">No run has been recorded.</li> : null}
            {board.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 text-sm text-ink">
                <span>{row.codes} · {row.status}</span>
                <span className="tabular-nums">{money(row.allowed)}{row.scriptSeconds != null ? ` · script ${row.scriptSeconds}s` : ""}{row.humanSeconds != null ? ` · you ${row.humanSeconds}s` : ""}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl text-ink">Gold set</h2>
          <p className="mt-2 text-sm text-muted">{gold.length} rows. {labeled} labeled. A label is yours. The desk does not invent one.</p>
          <ul className="mt-4 space-y-2">
            {gold.slice(0, 8).map((row) => (
              <li key={row.id} className="text-sm text-ink">{row.code} × {row.units} · {row.label} · {money(row.allowed)}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl text-ink">File updates</h2>
          <ul className="mt-4 space-y-3">
            {UPDATES.map((row) => (
              <li key={row.name} className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">
                <span className="font-medium">{row.name}.</span> {row.cadence}. Loaded: {row.loaded}. Next: {row.next}.
                {row.gap ? <span className="mt-1 block text-muted">{row.gap}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Shell>
  );
}

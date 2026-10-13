import { Link } from "@tanstack/react-router";
import { money } from "@/lib/desk/clock";
import { FEE_TEAMS, feeTeamReport, type FeeLine } from "@/lib/team/fee-teams";

export function FeeTeamList() {
  return (
    <ol className="mt-8 grid gap-4 lg:grid-cols-3">
      {FEE_TEAMS.map((team) => (
        <li key={team.id} id={team.id} className="scroll-mt-28 rounded-2xl border border-line p-5">
          <p className="text-xs font-medium tracking-widest text-teal uppercase">On the fee</p>
          <h2 className="mt-1 font-display text-3xl text-ink">{team.name}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink">{team.does}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{team.doesNot}</p>
          <Link to="/" hash="intake" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-teal">
            Open the bill
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function FeeTeamReport({ lines }: { lines: FeeLine[] }) {
  const report = feeTeamReport(lines);
  const cards = [
    { name: "Fee management", detail: report.fee.detail },
    { name: "Finder", detail: report.finder.detail },
    { name: "Audit", detail: report.audit.wrong > 0 ? `${report.audit.detail} ${money(report.audit.gap / 100)} under the correct fee.` : report.audit.detail },
  ];
  return (
    <section className="mt-4">
      <h3 className="font-display text-2xl text-ink">The three teams</h3>
      <ul className="mt-3 grid gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.name} className="rounded-2xl border border-line px-4 py-3">
            <p className="text-sm font-medium text-ink">{card.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{card.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

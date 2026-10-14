import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/landing/shell";
import { money } from "@/lib/desk/clock";
import { workpaper, type Paper } from "@/lib/account/workpaper";
import { readHeld } from "@/lib/account/held-sheet";
import type { Roll } from "@/lib/lookup/sheet-book";

export function TrendsPage() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const held = readHeld();
    if (!held || held.lines.length === 0) return;
    setName(held.name);
    setPaper(workpaper(held.lines));
  }, []);
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-6">
        <p className="text-[13px] text-muted">{name ?? "No sheet yet"}</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">Trends</h1>
        {paper ? <TrendChart paper={paper} /> : (
          <div className="mt-6 overflow-hidden rounded-[10px] bg-paper-2">
            <p className="px-4 py-3 text-[17px] text-ink">Bring a sheet on Sheet. The chart stays on this page.</p>
            <Link to="/" className="press flex min-h-12 items-center border-t border-line px-4 text-[17px] text-teal">Go to Sheet</Link>
          </div>
        )}
      </main>
    </Shell>
  );
}

function picture(paper: Paper) {
  const match = Math.max(paper.lines - paper.exceptions.length, 0);
  const off = Math.max(paper.exceptions.length - paper.unknown, 0);
  const years = [...paper.rolls.years].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const biggest = years.find((row) => row.diff !== 0);
  let insight = "Every priced line matches the file.";
  if (paper.lines === 0) insight = "No lines in this view.";
  else if (paper.unknown === paper.lines) insight = "No file amount on this view. Nothing was filled in.";
  else if (biggest) insight = biggest.diff > 0 ? `${biggest.name} is ${money(biggest.diff / 100)} under the file.` : `${biggest.name} is ${money(Math.abs(biggest.diff) / 100)} over the file.`;
  return { match, off, unknown: paper.unknown, total: Math.max(paper.lines, 1), insight };
}

function TrendChart({ paper }: { paper: Paper }) {
  const view = picture(paper);
  const share = (count: number) => `${(count / view.total) * 100}%`;
  return (
    <div className="mt-8">
      <p className="num text-[17px] leading-relaxed text-ink">{view.insight}</p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <span className="h-3 bg-teal" style={{ width: share(view.match) }} />
        <span className="h-3 bg-alert" style={{ width: share(view.off) }} />
        <span className="h-3 bg-wait" style={{ width: share(view.unknown) }} />
      </div>
      <p className="mt-3 text-[13px] text-muted">{view.match} match. {view.off} do not. {view.unknown} need a person.</p>
      <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">By year</h2>
      <RollList rolls={paper.rolls.years} empty="One year, or no dollars. No year chart." />
      <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">By file</h2>
      <RollList rolls={paper.rolls.files} empty="One file, or no dollars. No file chart." />
    </div>
  );
}

function RollList({ rolls, empty }: { rolls: Roll[]; empty: string }) {
  const rows = rolls.filter((row) => row.you > 0 || row.them > 0);
  if (rows.length === 0) return <p className="text-[15px] text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.flatMap((row) => [row.you, row.them]));
  return (
    <div className="overflow-hidden rounded-[10px] bg-paper-2">
      {rows.map((row) => (
        <details key={row.name} className="border-b border-line last:border-b-0">
          <summary className="cursor-pointer px-4 py-3">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] text-ink">{row.name}</span>
              <span className={row.diff === 0 ? "num text-[13px] text-muted" : row.diff > 0 ? "num text-[13px] text-wait" : "num text-[13px] text-alert"}>{row.diff === 0 ? "Same" : row.diff > 0 ? `${money(row.diff / 100)} under` : `${money(Math.abs(row.diff) / 100)} over`}</span>
            </span>
            <Bar width={row.you / max} tone="bg-teal" />
          </summary>
          <ul className="space-y-2 px-4 pb-4 text-[15px] text-ink">
            <li className="flex justify-between gap-3"><span className="text-muted">You pay</span><span className="num">{money(row.you / 100)}</span></li>
            <li className="flex justify-between gap-3"><span className="text-muted">They want</span><span className="num">{row.them ? money(row.them / 100) : "—"}</span></li>
            <li className="flex justify-between gap-3"><span className="text-muted">Lines</span><span className="num">{row.lines}</span></li>
            <li className="flex justify-between gap-3"><span className="text-muted">Flagged</span><span className="num">{row.flagged}</span></li>
          </ul>
        </details>
      ))}
    </div>
  );
}

function Bar({ width, tone }: { width: number; tone: string }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
      <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, width * 100))}%` }} />
    </div>
  );
}

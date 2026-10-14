import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { money } from "@/lib/desk/clock";

type FamilySummary = {
  id: string;
  label: string;
  codes: number;
  changed: number;
  up: number;
  down: number;
  flat: number;
  oneYear: number;
};

type Move = { c: string; n: string; from: number; fc: number; to: number; tc: number; d: number };

export function HistoryPage() {
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [note, setNote] = useState("");
  const [family, setFamily] = useState("ambulance");
  const [rows, setRows] = useState<Move[]>([]);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(30);
  const [state, setState] = useState<"loading" | "ready" | "down">("loading");

  useEffect(() => {
    fetch("/history/summary.json")
      .then((response) => response.json())
      .then((data: { compared: string; families: FamilySummary[] }) => {
        setNote(data.compared);
        setFamilies(data.families);
      })
      .catch(() => setState("down"));
  }, []);

  useEffect(() => {
    let cancel = false;
    setState("loading");
    setShown(30);
    fetch(`/history/${family}.json`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json();
      })
      .then((data: Move[]) => {
        if (cancel) return;
        setRows(data);
        setState("ready");
      })
      .catch(() => {
        if (!cancel) setState("down");
      });
    return () => {
      cancel = true;
    };
  }, [family]);

  const needle = query.trim().toUpperCase();
  const filtered = needle ? rows.filter((row) => row.c.includes(needle) || row.n.toUpperCase().includes(needle)) : rows;
  const visible = filtered.slice(0, shown);

  return (
    <Shell>
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-[13px] text-muted">2020–2026</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">Codes that changed.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{note || "The first loaded amount against the last loaded amount."}</p>
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {families.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFamily(item.id)}
              className={item.id === family ? "h-10 shrink-0 rounded-full bg-teal px-3 text-sm font-medium text-teal-ink" : "h-10 shrink-0 rounded-full border border-line px-3 text-sm text-ink"}
            >
              {item.label}
            </button>
          ))}
        </div>
        {families.filter((item) => item.id === family).map((item) => (
          <p key={item.id} className="mt-4 text-sm leading-relaxed text-ink">
            {item.changed.toLocaleString()} changed. {item.up.toLocaleString()} went up and {item.down.toLocaleString()} went down. {item.flat.toLocaleString()} stayed the same. {item.oneYear.toLocaleString()} have only one priced year, so they are not a change.
          </p>
        ))}
        <label className="mt-4 block text-sm font-medium text-ink">
          Find a code or a name
          <input value={query} onChange={(event) => { setQuery(event.target.value); setShown(30); }} placeholder="97110" className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-4 text-base" />
        </label>
        {state === "loading" ? <p className="mt-4 text-sm text-muted">Loading this schedule.</p> : null}
        {state === "down" ? <p className="mt-4 text-sm text-deep">The history file did not load.</p> : null}
        <ul className="mt-4 space-y-2">
          {visible.map((row) => (
            <li key={row.c}>
              <a href={`/code?c=${row.c}`} className="block rounded-[10px] bg-paper-2 px-4 py-3">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{row.c}</span>
                  <span className={row.d < 0 ? "text-sm font-medium text-deep" : "text-sm font-medium text-teal"}>{row.d < 0 ? "Down" : "Up"} {money(Math.abs(row.d) / 100)}</span>
                </span>
                <span className="mt-1 block text-sm text-ink">{row.n}</span>
                <span className="mt-1 block text-sm text-muted">{row.from} {money(row.fc / 100)} → {row.to} {money(row.tc / 100)}</span>
              </a>
            </li>
          ))}
        </ul>
        {state === "ready" && visible.length === 0 ? <p className="mt-4 text-sm text-muted">Nothing in this schedule matches.</p> : null}
        {shown < filtered.length ? (
          <button type="button" onClick={() => setShown((count) => count + 30)} className="mt-4 h-12 rounded-full border border-line px-4 text-sm font-medium text-ink">
            Show more
          </button>
        ) : null}
      </main>
    </Shell>
  );
}

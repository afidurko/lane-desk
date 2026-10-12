import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { describeCode } from "@/lib/lookup/describe";
import { previousUse, pricedYears } from "@/lib/lookup/reason";
import { addToOpenClaim } from "@/lib/billing/store";
import { type OnceRow } from "@/lib/lookup/once";
import { money } from "@/lib/desk/clock";
import { Link } from "@tanstack/react-router";

const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;

export function CodePage() {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<{ family: Family; label: string; row: Row }[]>([]);
  const [once, setOnce] = useState<OnceRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "miss" | "bad" | "down">("idle");

  useEffect(() => {
    const passed = new URLSearchParams(window.location.search).get("c");
    if (passed) setText(passed.toUpperCase());
  }, []);

  useEffect(() => {
    const clean = text.trim().toUpperCase();
    if (!clean) {
      setHits([]);
      setOnce([]);
      setState("idle");
      return;
    }
    if (!CODE.test(clean)) {
      setHits([]);
      setOnce([]);
      setState("bad");
      return;
    }
    let cancel = false;
    setState("loading");
    Promise.all([findAcross(clean), loadOnce(clean[0])])
      .then(([found, shard]) => {
        if (cancel) return;
        const extra = shard[clean] ?? [];
        setHits(found);
        setOnce(extra);
        setState(found.length > 0 || extra.length > 0 ? "ready" : "miss");
      })
      .catch(() => {
        if (cancel) return;
        setHits([]);
        setOnce([]);
        setState("down");
      });
    return () => {
      cancel = true;
    };
  }, [text]);

  return (
    <Shell>
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">One code</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink">What it is, and what it paid.</h1>
        <label className="mt-6 block text-sm font-medium text-ink" htmlFor="one-code">
          Code
          <input
            id="one-code"
            value={text}
            onChange={(event) => setText(event.target.value.toUpperCase())}
            placeholder="97110"
            autoCapitalize="characters"
            autoCorrect="off"
            className="mt-1.5 h-14 w-full rounded-2xl border border-line bg-paper-2 px-4 font-display text-2xl text-ink"
          />
        </label>
        {state === "idle" ? <p className="mt-4 text-sm text-muted">Type one code. The schedule is chosen for you. <a href="/history" className="font-medium text-teal">Or see the codes that changed.</a></p> : null}
        {state === "bad" ? <p className="mt-4 text-sm text-muted">Use a full code, such as 97110 or A0428.</p> : null}
        {state === "loading" ? <p className="mt-4 text-sm text-muted">Loading the file description and every year.</p> : null}
        {state === "miss" ? <p className="mt-4 text-sm font-medium text-deep">That code is not on a loaded schedule for 2020 through 2026.</p> : null}
        {state === "down" ? <p className="mt-4 text-sm font-medium text-deep">The year files did not load. The page is still here. Type the code again.</p> : null}
        {hits.map((hit) => (
          <article key={hit.family} className="mt-8">
            <p className="font-display text-4xl text-ink tabular-nums">{text.trim().toUpperCase()}</p>
            <p className="mt-1 text-xs font-medium tracking-widest text-teal uppercase">{hit.label}</p>
            <h2 className="mt-4 text-sm font-medium text-ink">What it is</h2>
            <p className="mt-1 text-lg text-ink">{hit.row.n || "The file has no short name for this code."}</p>
            <h2 className="mt-4 text-sm font-medium text-ink">Description</h2>
            <p className="mt-1 text-base leading-relaxed text-ink">{describeCode(hit.label, hit.row)}</p>
            <h2 className="mt-4 text-sm font-medium text-ink">Years and amounts</h2>
            <YearPrices row={hit.row} />
            <PriorNote row={hit.row} />
            <div className="mt-3 flex flex-wrap gap-2">
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((year) => {
                const cents = hit.row.a[String(year)];
                if (typeof cents !== "number") return null;
                return (
                  <button
                    key={year}
                    type="button"
                    className="h-11 rounded-full border border-line px-3 text-sm text-ink"
                    onClick={() => {
                      addToOpenClaim({
                        code: text.trim().toUpperCase(),
                        modifier: "",
                        units: 1,
                        chargeCents: cents,
                        allowedCents: cents,
                        schedule: `${hit.label}, ${year}`,
                        note: hit.row.n || text.trim().toUpperCase(),
                        year,
                      });
                      setNote(`${year} ${money(cents / 100)} is on the claim. Nothing is sent.`);
                    }}
                  >
                    Use {year}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
        {once.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-ink">This period only</h2>
            <ul className="mt-3 space-y-3">
              {once.map((row) => (
                <li key={`${row.s}-${row.t}`} className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-xs font-medium tracking-widest text-teal uppercase">{row.s}</p>
                  <p className="mt-1 text-sm text-muted">{row.n}</p>
                  <p className="mt-1 text-base font-medium text-ink tabular-nums">{money(row.c / 100)}</p>
                  <p className="text-xs text-muted">{row.t}</p>
                  <button
                    type="button"
                    className="mt-2 h-11 rounded-full border border-line px-3 text-sm text-ink"
                    onClick={() => {
                      const year = Number(row.t.match(/20\d{2}/)?.[0] ?? "2026");
                      addToOpenClaim({
                        code: text.trim().toUpperCase(),
                        modifier: "",
                        units: 1,
                        chargeCents: row.c,
                        allowedCents: row.c,
                        schedule: `${row.s}, ${row.t}`,
                        note: row.n,
                        year: year >= 2020 && year <= 2026 ? year : 2026,
                      });
                      setNote(`${row.s} ${money(row.c / 100)} is on the claim. Nothing is sent.`);
                    }}
                  >
                    Use this amount
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {note ? (
          <p className="mt-4 text-sm text-ink" role="status">
            {note}{" "}
            <Link to="/billing" className="font-medium text-teal">
              Open the claim.
            </Link>
          </p>
        ) : null}
      </main>
    </Shell>
  );
}

function PriorNote({ row }: { row: { a: Record<string, number | null> } }) {
  const years = pricedYears(row.a);
  if (years.length < 2) return null;
  const note = previousUse(years, years[0].year, null, years[0].cents);
  if (!note) return null;
  return <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>;
}

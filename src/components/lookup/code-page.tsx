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
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-6">
        <p className="text-[13px] text-muted">One code</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">Price</h1>
        <label className="mt-6 block" htmlFor="one-code">
          <span className="px-4 text-[13px] text-muted">Code</span>
          <input
            id="one-code"
            value={text}
            onChange={(event) => setText(event.target.value.toUpperCase())}
            placeholder="97110"
            autoCapitalize="characters"
            autoCorrect="off"
            className="mt-2 h-14 w-full rounded-[10px] bg-paper-2 px-4 text-[22px] font-medium text-ink outline-none"
          />
        </label>
        {state === "idle" ? <p className="mt-4 text-sm text-muted">Type a code, like 97110. The name and the price for each year show up here.</p> : null}
        {state === "bad" ? <p className="mt-4 text-sm text-muted">Type the whole code, like 97110.</p> : null}
        {state === "loading" ? <p className="mt-4 text-sm text-muted">Loading the file description and every year.</p> : null}
        {state === "miss" ? <p className="mt-4 text-sm font-medium text-deep">That code is not on a loaded schedule for 2020 through 2026.</p> : null}
        {state === "down" ? <p className="mt-4 text-sm font-medium text-deep">The year files did not load. The page is still here. Type the code again.</p> : null}
        {hits.map((hit) => (
          <article key={hit.family} className="mt-6">
            <h2 className="px-4 pb-2 text-[13px] text-muted">{hit.label}</h2>
            <div className="overflow-hidden rounded-[10px] bg-paper-2">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[17px] font-medium text-ink tabular-nums">{text.trim().toUpperCase()}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">{hit.row.n || "The file has no short name for this code."}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{describeCode(hit.label, hit.row)}</p>
              </div>
            </div>
            <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">Years and amounts</h2>
            <YearPrices row={hit.row} />
            <PriorNote row={hit.row} />
            <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">Keep a year</h2>
            <div className="overflow-hidden rounded-[10px] bg-paper-2">
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((year) => {
                const cents = hit.row.a[String(year)];
                if (typeof cents !== "number") return null;
                return (
                  <button
                    key={year}
                    type="button"
                    className="press flex min-h-12 w-full items-center justify-between border-b border-line px-4 text-left text-[17px] text-teal last:border-b-0"
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
                    <span>Use {year}</span>
                    <span className="text-ink tabular-nums">{money(cents / 100)}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
        {once.length > 0 ? (
          <section className="mt-2">
            <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">This period only</h2>
            <div className="overflow-hidden rounded-[10px] bg-paper-2">
              {once.map((row) => (
                <div key={`${row.s}-${row.t}`} className="border-b border-line px-4 py-3 last:border-b-0">
                  <p className="text-[17px] text-ink">{row.s}</p>
                  <p className="mt-1 text-[15px] text-muted">{row.n}</p>
                  <p className="mt-1 text-[17px] font-medium text-ink tabular-nums">{money(row.c / 100)}</p>
                  <p className="text-[13px] text-muted">{row.t}</p>
                  <button
                    type="button"
                    className="press mt-2 text-[17px] text-teal"
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
                </div>
              ))}
            </div>
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

import { useEffect, useState } from "react";
import { Empty, FIELD, LINK, Page, ReferenceNote, SECONDARY } from "@/components/ui";
import { IS_INTERNAL } from "@/lib/config/mode";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { describeCode } from "@/lib/lookup/describe";
import { loadMppr } from "@/lib/pricing/books";
import type { MpprInfo } from "@/lib/pricing/national";
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

  const clean = text.trim().toUpperCase();
  return (
    <Page
      kicker="Look up a code"
      title="What a code is, and its Medicare reference price"
      lede="Type one billing code. You get the name on the Medicare fee file and the reference price for it. The price comes from the loaded file and nothing is typed in by hand."
    >
      <label className="block text-sm font-medium text-ink" htmlFor="one-code">
        Code
        <input
          id="one-code"
          value={text}
          onChange={(event) => setText(event.target.value.toUpperCase())}
          placeholder="Five characters, such as 97110"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={5}
          aria-describedby="code-state"
          className={`${FIELD} h-14 font-display text-2xl`}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Try</span>
        {["97110", "97140", "99213"].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setText(code)}
            className="h-11 rounded-full border border-muted bg-paper-2 px-4 text-sm font-medium text-ink hover:border-teal"
          >
            {code}
          </button>
        ))}
      </div>
      <div id="code-state" className="mt-5" aria-live="polite">
        {state === "idle" ? <Empty>Type a code, or pick one above. The reference price appears here.</Empty> : null}
        {state === "bad" ? <p className="text-sm text-muted">A code is five characters, such as 97110 or A0428.</p> : null}
        {state === "loading" ? <p className="text-sm text-muted">Loading the fee file.</p> : null}
        {state === "miss" ? <p className="text-sm font-medium text-deep">{clean} is not on the loaded fee file.</p> : null}
        {state === "down" ? (
          <p className="text-sm font-medium text-deep" role="alert">
            The fee file did not load. Type the code again, or reload the page.
          </p>
        ) : null}
      </div>
      {hits.map((hit) => (
        <article key={hit.family} className="mt-4 rounded-2xl border border-line bg-paper-2 p-5">
          <p className="font-display text-4xl text-ink tabular-nums">{clean}</p>
          <p className="mt-1 text-xs font-medium tracking-widest text-teal uppercase">{hit.label}</p>
          <h2 className="mt-4 text-sm font-medium text-ink">What it is</h2>
          <p className="mt-1 text-lg text-ink">{hit.row.n || "The file has no short name for this code."}</p>
          <h2 className="mt-4 text-sm font-medium text-ink">About this price</h2>
          <p className="mt-1 text-base leading-relaxed text-ink">{describeCode(hit.label, hit.row)}</p>
          <h2 className="mt-4 text-sm font-medium text-ink">{IS_INTERNAL ? "Years and amounts" : "Reference price, 2026"}</h2>
          <YearPrices row={hit.row} family={hit.family} />
          <ReferenceNote />
          {IS_INTERNAL ? <PriorNote row={hit.row} /> : null}
          {IS_INTERNAL ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((year) => {
                const cents = hit.row.a[String(year)];
                if (typeof cents !== "number") return null;
                return (
                  <button
                    key={year}
                    type="button"
                    className={SECONDARY}
                    onClick={async () => {
                      // A therapy code carries its reduction values so the worksheet can apply the cut across the claim.
                      const info = (await loadMppr(year).catch(() => ({}) as Record<string, MpprInfo>))[clean];
                      addToOpenClaim({
                        code: clean,
                        modifier: "",
                        units: 1,
                        chargeCents: cents,
                        allowedCents: cents,
                        ...(info && info.fullCents === cents ? { mppr: { pe: info.pe, reducedCents: info.reducedCents } } : {}),
                        schedule: `${hit.label}, ${year}`,
                        note: hit.row.n || clean,
                        year,
                      });
                      setNote(`${year} ${money(cents / 100)} is on the claim worksheet.`);
                    }}
                  >
                    Use {year} (internal)
                  </button>
                );
              })}
            </div>
          ) : null}
        </article>
      ))}
      {IS_INTERNAL && once.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink">This period only</h2>
          <ul className="mt-3 space-y-3">
            {once.map((row) => (
              <li key={`${row.s}-${row.t}`} className="rounded-2xl border border-line bg-paper-2 px-4 py-3">
                <p className="text-xs font-medium tracking-widest text-teal uppercase">{row.s}</p>
                <p className="mt-1 text-sm text-muted">{row.n}</p>
                <p className="mt-1 text-base font-medium text-ink tabular-nums">{money(row.c / 100)}</p>
                <p className="text-xs text-muted">{row.t}</p>
              </li>
            ))}
          </ul>
          <ReferenceNote scope={false} />
        </section>
      ) : null}
      {note ? (
        <p className="mt-4 text-sm text-ink" role="status">
          {note}{" "}
          <Link to="/billing" className={LINK}>
            Open the worksheet.
          </Link>
        </p>
      ) : null}
      {hits.length > 0 ? (
        <p className="mt-8 border-t border-line pt-5">
          <Link to="/invoice" className={LINK}>
            Next: check an invoice line against this price
          </Link>
        </p>
      ) : null}
    </Page>
  );
}

function PriorNote({ row }: { row: { a: Record<string, number | null> } }) {
  const years = pricedYears(row.a);
  if (years.length < 2) return null;
  const note = previousUse(years, years[0].year, null, years[0].cents);
  if (!note) return null;
  return <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>;
}

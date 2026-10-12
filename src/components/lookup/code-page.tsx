import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { findAcross, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { describeCode } from "@/lib/lookup/describe";

const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;

export function CodePage() {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<{ family: Family; label: string; row: Row }[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "miss" | "bad" | "down">("idle");

  useEffect(() => {
    const passed = new URLSearchParams(window.location.search).get("c");
    if (passed) setText(passed.toUpperCase());
  }, []);

  useEffect(() => {
    const clean = text.trim().toUpperCase();
    if (!clean) {
      setHits([]);
      setState("idle");
      return;
    }
    if (!CODE.test(clean)) {
      setHits([]);
      setState("bad");
      return;
    }
    let cancel = false;
    setState("loading");
    findAcross(clean)
      .then((found) => {
        if (cancel) return;
        setHits(found);
        setState(found.length > 0 ? "ready" : "miss");
      })
      .catch(() => {
        if (cancel) return;
        setHits([]);
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
        {state === "idle" ? <p className="mt-4 text-sm text-muted">Type one code. The schedule is chosen for you.</p> : null}
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
          </article>
        ))}
      </main>
    </Shell>
  );
}

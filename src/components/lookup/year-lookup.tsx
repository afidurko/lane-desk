import { useEffect, useState } from "react";
import { money } from "@/lib/desk/clock";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;
const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;
const FAMILIES = [
  { id: "physician", label: "Physician" },
  { id: "ambulance", label: "Ambulance" },
  { id: "lab", label: "Lab" },
  { id: "dme", label: "Equipment" },
] as const;

type Family = (typeof FAMILIES)[number]["id"];
type Row = { n: string; a: Record<string, number | null> };

const cache = new Map<string, Record<string, Row>>();

function loadShard(family: Family, prefix: string) {
  const key = `${family}/${prefix}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return fetch(`/years/${family}/${prefix}.json`).then(async (response) => {
    if (!response.ok) throw new Error("missing");
    const data = (await response.json()) as Record<string, Row>;
    cache.set(key, data);
    return data;
  });
}

export function YearList({ family, code, quiet = false }: { family: Family; code: string; quiet?: boolean }) {
  const [row, setRow] = useState<Row | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "miss" | "bad">("idle");

  useEffect(() => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setRow(null);
      setState("idle");
      return;
    }
    if (!CODE.test(clean)) {
      setRow(null);
      setState("bad");
      return;
    }
    let cancel = false;
    setState("loading");
    loadShard(family, clean[0])
      .then((shard) => {
        if (cancel) return;
        const found = shard[clean] ?? null;
        setRow(found);
        setState(found ? "ready" : "miss");
      })
      .catch(() => {
        if (!cancel) {
          setRow(null);
          setState("miss");
        }
      });
    return () => {
      cancel = true;
    };
  }, [family, code]);

  if (quiet && (state === "idle" || state === "bad")) return null;
  if (state === "idle") return <p className="text-sm text-muted">Type a code, such as 97110 or A0428.</p>;
  if (state === "bad") return <p className="text-sm text-muted">Use a full code, such as 97110 or A0428.</p>;
  if (state === "loading") return <p className="text-sm text-muted">Loading every year for {code.trim().toUpperCase()}.</p>;
  if (state === "miss" || !row) return <p className="text-sm font-medium text-deep">That code is not on this schedule for 2020 through 2026.</p>;

  return (
    <div>
      <p className="font-display text-3xl text-ink">{code.trim().toUpperCase()}</p>
      {row.n ? <p className="mt-1 text-sm leading-relaxed text-muted">{row.n}</p> : null}
      <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {YEARS.map((year, index) => {
          const cents = row.a[String(year)];
          const older = row.a[String(year - 1)];
          const changed = typeof cents === "number" && typeof older === "number" && cents !== older;
          const delta = changed ? cents - older : 0;
          return (
            <li key={year} className="flex items-center justify-between gap-3 bg-paper px-4 py-3">
              <span className="font-display text-2xl text-ink tabular-nums">{year}</span>
              <span className="text-right">
                <span className="block text-base font-medium text-ink tabular-nums">
                  {typeof cents === "number" ? money(cents / 100) : cents === null ? "No separate amount" : "Not on the file"}
                </span>
                {changed ? (
                  <span className="text-xs text-teal">
                    {delta > 0 ? "Up" : "Down"} {money(Math.abs(delta) / 100)} from {year - 1}
                  </span>
                ) : index < YEARS.length - 1 && typeof cents === "number" && cents === older ? (
                  <span className="text-xs text-muted">Same as {year - 1}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function YearLookup() {
  const [family, setFamily] = useState<Family>("physician");
  const [text, setText] = useState("");

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Schedule">
        {FAMILIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFamily(item.id)}
            className={
              family === item.id
                ? "h-11 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink"
                : "h-11 rounded-full border border-line px-4 text-sm text-ink"
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="code-lookup">
        Code
        <input
          id="code-lookup"
          value={text}
          onChange={(event) => setText(event.target.value.toUpperCase())}
          placeholder="97110"
          autoCapitalize="characters"
          autoCorrect="off"
          className="mt-1.5 h-14 w-full rounded-2xl border border-line bg-paper-2 px-4 font-display text-2xl text-ink"
        />
      </label>
      <div className="mt-5">
        <YearList family={family} code={text} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Rest of New York, locality 99. Physician amounts are non-facility. The same code is listed once for each year because the amount changes.
      </p>
    </div>
  );
}

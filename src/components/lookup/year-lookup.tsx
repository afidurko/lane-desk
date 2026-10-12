import { useEffect, useState } from "react";
import { money } from "@/lib/desk/clock";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { IS_INTERNAL, PUBLIC_SCOPE, visibleYears } from "@/lib/config/mode";
import { loadNational } from "@/lib/pricing/national";

export const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;
const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;
export const FAMILIES = [
  { id: "physician", label: "Physician" },
  { id: "ambulance", label: "Ambulance" },
  { id: "lab", label: "Lab" },
  { id: "dme", label: "Equipment" },
] as const;

export type Family = (typeof FAMILIES)[number]["id"];
export type Row = { n: string; a: Record<string, number | null>; s?: string };

const cache = new Map<string, Record<string, Row>>();

export function loadShard(family: Family, prefix: string) {
  const key = `${family}/${prefix}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return fetch(`/years/${family}/${prefix}.json`).then(async (response) => {
    if (response.status === 404) {
      const empty: Record<string, Row> = {};
      cache.set(key, empty);
      return empty;
    }
    if (!response.ok) throw new Error("missing");
    const data = (await response.json()) as Record<string, Row>;
    cache.set(key, data);
    return data;
  });
}

/** Public mode: one national 2026 physician row, nothing else. */
async function findNational(clean: string) {
  const national = await loadNational();
  const row = national.rows.get(clean);
  return row ? [{ family: "physician" as Family, label: PUBLIC_SCOPE.label, row: row as Row }] : [];
}

export async function findAcross(code: string) {
  const clean = code.trim().toUpperCase();
  if (!CODE.test(clean)) return [];
  if (!IS_INTERNAL) return findNational(clean);
  const hits: { family: Family; label: string; row: Row }[] = [];
  let failed = 0;
  let tried = 0;
  for (const family of FAMILIES) {
    tried += 1;
    try {
      const shard = await loadShard(family.id, clean[0]);
      const row = shard[clean];
      if (row) hits.push({ family: family.id, label: family.label, row });
    } catch {
      failed += 1;
    }
  }
  if (tried > 0 && failed === tried) throw new Error("The year files did not load.");
  return hits;
}

const onceCache = new Map<string, Record<string, OnceRow[]>>();

export function loadOnce(prefix: string) {
  if (!IS_INTERNAL) return Promise.resolve({} as Record<string, OnceRow[]>);
  const hit = onceCache.get(prefix);
  if (hit) return Promise.resolve(hit);
  return fetch(`/once/${prefix}.json`).then(async (response) => {
    if (response.status === 404) {
      const empty: Record<string, OnceRow[]> = {};
      onceCache.set(prefix, empty);
      return empty;
    }
    if (!response.ok) throw new Error("missing");
    const data = (await response.json()) as Record<string, OnceRow[]>;
    onceCache.set(prefix, data);
    return data;
  });
}

export { pickOnce };

export function YearList({ family, code, quiet = false }: { family: Family; code: string; quiet?: boolean }) {
  const [row, setRow] = useState<Row | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "miss" | "bad" | "down">("idle");

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
          setState("down");
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
  if (state === "down") return <p className="text-sm font-medium text-deep">The year file did not load. Try the code again.</p>;
  if (state === "miss" || !row)
    return <p className="text-sm font-medium text-deep">That code is not on this schedule for 2020 through 2026.</p>;

  return (
    <div>
      <p className="font-display text-3xl text-ink">{code.trim().toUpperCase()}</p>
      {row.n ? <p className="mt-1 text-sm leading-relaxed text-muted">{row.n}</p> : null}
      <YearPrices row={row} />
    </div>
  );
}

export function YearPrices({ row, mark }: { row: Row; mark?: number | null }) {
  return (
    <ol className="mt-3 grid grid-cols-2 gap-2">
      {visibleYears(YEARS).map((year) => {
        const cents = row.a[String(year)];
        const older = row.a[String(year - 1)];
        const changed = IS_INTERNAL && typeof cents === "number" && typeof older === "number" && cents !== older;
        const marked = mark === year;
        return (
          <li
            key={year}
            className={marked ? "rounded-xl border border-teal bg-paper-2 px-3 py-2" : "rounded-xl border border-line px-3 py-2"}
          >
            <span className="block text-xs text-muted">
              {year}
              {marked ? " · on the invoice" : ""}
            </span>
            <span className="mt-0.5 block text-base font-medium text-ink tabular-nums">
              {typeof cents === "number" ? money(cents / 100) : cents === null ? "No amount" : "Not on file"}
            </span>
            {changed ? (
              <span className="text-xs text-teal">
                {cents - older > 0 ? "Up" : "Down"} {money(Math.abs(cents - older) / 100)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function YearLookup() {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<{ family: Family; label: string; row: Row }[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "miss" | "bad" | "down">("idle");

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
        if (!cancel) {
          setHits([]);
          setState("down");
        }
      });
    return () => {
      cancel = true;
    };
  }, [text]);

  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor="code-lookup">
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
        {state === "idle" ? <p className="text-sm text-muted">Type a code. The schedule is chosen for you.</p> : null}
        {state === "bad" ? <p className="text-sm text-muted">Use a full code, such as 97110 or A0428.</p> : null}
        {state === "loading" ? <p className="text-sm text-muted">Checking every schedule.</p> : null}
        {state === "miss" ? (
          <p className="text-sm font-medium text-deep">That code is not on a loaded schedule for 2020 through 2026.</p>
        ) : null}
        {state === "down" ? <p className="text-sm font-medium text-deep">The year files did not load. Type the code again.</p> : null}
        {hits.map((hit) => (
          <section key={hit.family} className="mt-4">
            <p className="text-xs font-medium tracking-widest text-teal uppercase">{hit.label}</p>
            {hit.row.n && hit.row.n !== text.trim().toUpperCase() ? <p className="mt-1 text-sm text-muted">{hit.row.n}</p> : null}
            <YearPrices row={hit.row} />
          </section>
        ))}
      </div>
    </div>
  );
}

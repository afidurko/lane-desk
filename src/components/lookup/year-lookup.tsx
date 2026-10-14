import { useEffect, useState } from "react";
import { money } from "@/lib/desk/clock";
import { morePosted, unknownBeside, type MoreYear } from "@/lib/lookup/reason";
import type { SavedRow } from "@/lib/lookup/saved-codes";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";

export const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;
const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;
export const FAMILIES = [
  { id: "physician", label: "Physician" },
  { id: "ambulance", label: "Ambulance" },
  { id: "lab", label: "Lab" },
  { id: "dme", label: "Equipment" },
] as const;

export type Family = (typeof FAMILIES)[number]["id"];
export type Row = {
  n: string;
  a: Record<string, number | null>;
  s?: string;
  f?: Record<string, number | null>;
  p?: Record<string, Record<string, number | null>>;
};

let savedCache: Promise<SavedRow[]> | null = null;

function loadSavedCard() {
  savedCache ??= fetch("/saved-codes.json")
    .then(async (response) => {
      if (!response.ok) return [];
      const body = (await response.json()) as { groups?: { rows: SavedRow[] }[] };
      return body.groups?.flatMap((group) => group.rows) ?? [];
    })
    .catch(() => []);
  return savedCache;
}

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

export async function findAcross(code: string) {
  const clean = code.trim().toUpperCase();
  if (!CODE.test(clean)) return [];
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
  if (state === "miss" || !row) return <p className="text-sm font-medium text-deep">That code is not on this schedule for 2020 through 2026.</p>;

  return (
    <div>
      <p className="text-[22px] font-semibold tracking-tight text-ink">{code.trim().toUpperCase()}</p>
      {row.n ? <p className="mt-1 text-sm leading-relaxed text-muted">{row.n}</p> : null}
      <YearPrices row={row} />
    </div>
  );
}

export function YearPrices({ row, mark }: { row: Row; mark?: number | null }) {
  return (
    <ol className="mt-3 overflow-hidden rounded-[10px] bg-paper-2">
      {YEARS.map((year, index) => {
        const cents = row.a[String(year)];
        const older = row.a[String(year - 1)];
        const changed = typeof cents === "number" && typeof older === "number" && cents !== older;
        const marked = mark === year;
        const last = index === YEARS.length - 1;
        return (
          <li key={year} className={last ? "flex min-h-12 items-center justify-between gap-3 px-4" : "flex min-h-12 items-center justify-between gap-3 border-b border-line px-4"}>
            <span>
              <span className="block text-[17px] text-ink">{year}{marked ? " · on the invoice" : ""}</span>
              {changed ? <span className="text-[13px] text-teal">{cents - older > 0 ? "Up" : "Down"} {money(Math.abs(cents - older) / 100)}</span> : null}
            </span>
            <span className={marked ? "num text-[17px] font-medium text-teal tabular-nums" : "num text-[17px] text-ink tabular-nums"}>
              {typeof cents === "number" ? money(cents / 100) : cents === null ? "No amount" : "Not on file"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function YearLookup() {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<{ family: Family; label: string; row: Row }[]>([]);
  const [extra, setExtra] = useState<MoreYear[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "miss" | "bad" | "down">("idle");

  useEffect(() => {
    const clean = text.trim().toUpperCase();
    if (!clean) {
      setHits([]);
      setExtra([]);
      setState("idle");
      return;
    }
    if (!CODE.test(clean)) {
      setHits([]);
      setExtra([]);
      setState("bad");
      return;
    }
    let cancel = false;
    setState("loading");
    Promise.all([findAcross(clean), loadOnce(clean[0]), loadSavedCard()])
      .then(([found, shard, saved]) => {
        if (cancel) return;
        const covered = found.flatMap((hit) => Object.entries(hit.row.a).flatMap(([year, cents]) => (typeof cents === "number" ? [Number(year)] : [])));
        const more = morePosted(covered, saved, shard[clean] ?? [], clean);
        setHits(found);
        setExtra(more);
        setState(found.length > 0 || more.length > 0 ? "ready" : "miss");
      })
      .catch(() => {
        if (!cancel) {
          setHits([]);
          setExtra([]);
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
          className="mt-1.5 h-14 w-full rounded-[10px] bg-paper-2 px-4 text-[17px] font-semibold text-ink"
        />
      </label>
      <div className="mt-5">
        {state === "idle" ? <p className="text-sm text-muted">Type a code. The schedule is chosen for you.</p> : null}
        {state === "bad" ? <p className="text-sm text-muted">Use a full code, such as 97110 or A0428.</p> : null}
        {state === "loading" ? <p className="text-sm text-muted">Checking every schedule.</p> : null}
        {state === "miss" ? <p className="text-sm font-medium text-deep">That code is not on a loaded schedule for 2020 through 2026.</p> : null}
        {state === "down" ? <p className="text-sm font-medium text-deep">The year files did not load. Type the code again.</p> : null}
        {hits.map((hit) => (
          <section key={hit.family} className="mt-4">
            <p className="text-[13px] text-muted">{hit.label}</p>
            {hit.row.n && hit.row.n !== text.trim().toUpperCase() ? <p className="mt-1 text-sm text-muted">{hit.row.n}</p> : null}
            <YearPrices row={hit.row} />
            {typeof hit.row.a["2026"] === "number" ? null : (
              <p className="mt-2 text-sm text-muted">{unknownBeside(2026, Object.entries(hit.row.a).flatMap(([year, cents]) => (typeof cents === "number" ? [{ year: Number(year), cents }] : [])))}</p>
            )}
          </section>
        ))}
        {extra.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {extra.map((row) => (
              <li key={`${row.year}-${row.label}`} className="text-sm leading-relaxed text-ink">
                {row.year}. {money(row.cents / 100)}{row.other !== null ? `. The other schedule is ${money(row.other / 100)}` : ""}. {row.label}. Not used for another year.
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

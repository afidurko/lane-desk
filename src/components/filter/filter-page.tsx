import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { AMBULANCE_NAMES, type AmbulanceFile } from "@/lib/book/ambulance";
import { isProcedure, isTransport, payableStatus, STATUS_LABEL } from "@/lib/book/filter";
import { readInterest, writeInterest, type Interest } from "@/lib/book/interest";
import { type DmeFile, type LabFile } from "@/lib/book/other";
import { conversionFor, localityDollars, type PfsFile } from "@/lib/book/price";
import { money } from "@/lib/desk/clock";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;
type Family = "physician" | "ambulance" | "lab" | "dme";
type Preset = "all" | "procedure" | "transport";
type AnyFile = PfsFile | AmbulanceFile | LabFile | DmeFile;

type Shown = {
  key: string;
  code: string;
  name: string;
  note: string;
  amount: string | null;
};

export function FilterPage() {
  const cache = useRef(new Map<string, AnyFile>());
  const [family, setFamily] = useState<Family>("physician");
  const [year, setYear] = useState(2026);
  const [preset, setPreset] = useState<Preset>("transport");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("any");
  const [file, setFile] = useState<AnyFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [interest, setInterest] = useState<Interest[]>([]);
  const [onlyKept, setOnlyKept] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setInterest(readInterest());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeInterest(interest);
  }, [interest, ready]);

  useEffect(() => {
    const key = `${family}-${year}`;
    const cached = cache.current.get(key);
    if (cached) {
      setFile(cached);
      setFailed(false);
      return;
    }
    setFile(null);
    const path = family === "physician" ? `/pfs-${year}.json` : family === "ambulance" ? `/afs-${year}.json` : family === "lab" ? `/clfs-${year}.json` : `/dme-${year}.json`;
    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<AnyFile>;
      })
      .then((next) => {
        cache.current.set(key, next);
        setFile(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [family, year]);

  const rows = useMemo(() => buildRows(file, family, query, preset, status), [file, family, query, preset, status]);
  const keptIds = new Set(interest.map((item) => item.id));
  const visible = onlyKept ? rows.filter((row) => keptIds.has(row.key)) : rows;
  const listed = visible.slice(0, 80);

  function toggle(row: Shown) {
    setInterest((current) => {
      if (current.some((item) => item.id === row.key)) return current.filter((item) => item.id !== row.key);
      return [{ id: row.key, family, year, code: row.code, name: row.name }, ...current];
    });
  }

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Filter</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Keep the codes you want. The rest stay in the file.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Procedures in the surgery range are on the physician file. Transportation is split. Ambulance trips are priced on the ambulance file. Taxi, bus, and van codes are on the physician file as not valid for Medicare. Transport chairs are on New York DME.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-ink">
            Schedule
            <select value={family} onChange={(event) => setFamily(event.target.value as Family)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              <option value="physician">Physician</option>
              <option value="ambulance">Ambulance</option>
              <option value="lab">Clinical lab</option>
              <option value="dme">DMEPOS, New York</option>
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Year
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              {YEARS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Set
            <select value={preset} onChange={(event) => setPreset(event.target.value as Preset)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              <option value="all">Any code</option>
              <option value="procedure">Procedures, 10021–69990</option>
              <option value="transport">Transportation</option>
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Words or code
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="knee or A0130" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {family === "physician" ? (
            <label className="text-sm font-medium text-ink">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="ml-2 h-12 rounded-xl border border-line bg-paper-2 px-3 text-base">
                <option value="any">Any</option>
                <option value="A">Active</option>
                <option value="I">Not valid for Medicare</option>
                <option value="X">Statutory exclusion</option>
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={onlyKept} onChange={(event) => setOnlyKept(event.target.checked)} />
            Only codes I kept
          </label>
        </div>

        {failed ? <p className="mt-4 text-sm font-medium text-deep">That file did not load.</p> : null}
        {!file && !failed ? <p className="mt-4 text-sm text-muted">Loading the {year} file.</p> : null}
        {file ? (
          <p className="mt-4 text-sm text-muted">
            {visible.length.toLocaleString()} match{visible.length === 1 ? "" : "es"}. Showing {listed.length}. Physician amounts are Rest of New York, non-facility, non-QP. A code with no amount is still listed.
          </p>
        ) : null}

        <ul className="mt-4 overflow-hidden rounded-2xl border border-line">
          {listed.length === 0 ? (
            <li className="px-4 py-4 text-sm text-muted">
              {preset === "all" || preset === "procedure" ? "Type at least two characters. The procedure set is the surgery range, and it is too large to list whole." : "Nothing in this set on this file."}
            </li>
          ) : (
            listed.map((row) => (
              <li key={row.key} className="border-t border-line px-4 py-3 first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink tabular-nums">{row.code}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{row.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{row.note}{row.amount ? ` ${row.amount}.` : ""}</p>
                  </div>
                  <button type="button" onClick={() => toggle(row)} className="shrink-0 rounded-full border border-line px-3 py-2 text-sm font-medium text-ink">
                    {keptIds.has(row.key) ? "Kept" : "Keep"}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <h2 className="mt-12 font-display text-3xl text-ink">Kept in this browser</h2>
        <ul className="mt-4 space-y-2">
          {interest.length === 0 ? (
            <li className="text-sm text-muted">None yet.</li>
          ) : (
            interest.map((item) => (
              <li key={item.id} className="text-sm text-ink">
                {item.year} {item.code} {item.name}
              </li>
            ))
          )}
        </ul>
      </main>
    </Shell>
  );
}

function buildRows(file: AnyFile | null, family: Family, query: string, preset: Preset, status: string): Shown[] {
  if (!file) return [];
  const needle = query.trim().toLowerCase();
  const textOk = (code: string, name: string) => needle.length < 2 || code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);
  const presetOk = (code: string, name: string) => {
    if (preset === "transport") return isTransport(code, name);
    if (preset === "procedure") return isProcedure(code);
    return true;
  };
  const needsQuery = preset === "all" || preset === "procedure";

  if ("rows" in file && family === "physician" && "localities" in file) {
    const place = file.localities.find((item) => item.mac === "13282" && item.number === "99") ?? null;
    return file.rows
      .filter((row) => row.m === "" && (status === "any" || row.s === status) && presetOk(row.c, row.d) && textOk(row.c, row.d) && (!needsQuery || needle.length >= 2))
      .map((row) => {
        const label = STATUS_LABEL[row.s] ?? `Status ${row.s}.`;
        let amount: string | null = null;
        if (payableStatus(row.s)) {
          const conversion = conversionFor(row, "nonQp", file);
          const dollars = conversion ? localityDollars(row, "nf", place, conversion) : 0;
          amount = dollars > 0 ? money(dollars) : null;
        }
        return { key: `physician-${file.year}-${row.c}`, code: row.c, name: row.d, note: label, amount };
      });
  }

  if (family === "ambulance" && "rows" in file && file.rows[0] && "carrier" in file.rows[0]) {
    const ambulance = file as AmbulanceFile;
    const mine = ambulance.rows.filter((row) => row.carrier === "13282" && row.loc === "99");
    return mine
      .filter((row) => presetOk(row.c, AMBULANCE_NAMES[row.c] ?? "") && textOk(row.c, AMBULANCE_NAMES[row.c] ?? "") && (!needsQuery || needle.length >= 2))
      .map((row) => ({
        key: `ambulance-${ambulance.year}-${row.c}`,
        code: row.c,
        name: AMBULANCE_NAMES[row.c] ?? row.c,
        note: "Ambulance file, Rest of New York, rural ground.",
        amount: row.rural === null ? null : money(row.rural / 100),
      }));
  }

  if (family === "lab" && "rows" in file && file.rows[0] && "rate" in file.rows[0]) {
    const lab = file as LabFile;
    return lab.rows
      .filter((row) => presetOk(row.c, row.name) && textOk(row.c, row.name) && (!needsQuery || needle.length >= 2))
      .map((row) => ({
        key: `lab-${lab.year}-${row.c}-${row.m}`,
        code: row.m ? `${row.c}-${row.m}` : row.c,
        name: row.name,
        note: `Lab file. Indicator ${row.indicator || "blank"}.`,
        amount: row.rate === null ? null : money(row.rate / 100),
      }));
  }

  if (family === "dme" && "rows" in file && (file.rows.length === 0 || ("rural" in file.rows[0]))) {
    const dme = file as DmeFile;
    return dme.rows
      .filter((row) => presetOk(row.c, row.name) && textOk(row.c, row.name) && (!needsQuery || needle.length >= 2))
      .map((row) => ({
        key: `dme-${dme.year}-${row.c}-${row.m}-${row.m2}`,
        code: [row.c, row.m, row.m2].filter(Boolean).join(" "),
        name: row.name || "No description in the file.",
        note: "New York rural DME.",
        amount: row.rural === null ? null : money(row.rural / 100),
      }));
  }

  return [];
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { AMBULANCE_NAMES, type AmbulanceFile } from "@/lib/book/ambulance";
import { isProcedure, isTransport, payableStatus, STATUS_LABEL } from "@/lib/book/filter";
import { readInterest, writeInterest, type Interest } from "@/lib/book/interest";
import { type DmeFile, type LabFile } from "@/lib/book/other";
import { conversionFor, localityDollars, NOT_OFFICE_LABEL, notPricedInOffice, type PfsFile } from "@/lib/book/price";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { Note2024, YearList } from "@/components/lookup/year-lookup";
import { Link } from "@tanstack/react-router";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020] as const;
type Family = "physician" | "ambulance" | "lab" | "dme";
type Preset = "all" | "procedure" | "transport";
type AnyFile = PfsFile | AmbulanceFile | LabFile | DmeFile;

type Shown = {
  key: string;
  code: string;
  modifier: string;
  name: string;
  note: string;
  amount: string | null;
  cents: number | null;
};

export function FilterPage() {
  const cache = useRef(new Map<string, AnyFile>());
  const [family, setFamily] = useState<Family>("physician");
  const [year, setYear] = useState(2026);
  const [preset, setPreset] = useState<Preset>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("any");
  const [file, setFile] = useState<AnyFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [interest, setInterest] = useState<Interest[]>([]);
  const [onlyKept, setOnlyKept] = useState(false);
  const [ready, setReady] = useState(false);
  const [limit, setLimit] = useState(40);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    setInterest(readInterest());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeInterest(interest);
  }, [interest, ready]);

  useEffect(() => {
    setLimit(40);
  }, [family, year, preset, query, status, onlyKept]);

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

  const built = useMemo(() => buildRows(file, family, query, preset, status), [file, family, query, preset, status]);
  const keptIds = new Set(interest.map((item) => item.id));
  const visible = onlyKept ? built.rows.filter((row) => keptIds.has(row.key)) : built.rows;
  const listed = visible.slice(0, limit);
  const scheduleName = family === "physician" ? "Physician" : family === "ambulance" ? "Ambulance" : family === "lab" ? "Clinical lab" : "DMEPOS, New York";

  function toggle(row: Shown) {
    setInterest((current) => {
      if (current.some((item) => item.id === row.key)) return current.filter((item) => item.id !== row.key);
      return [{ id: row.key, family, year, code: row.code, name: row.name }, ...current];
    });
  }

  function add(row: Shown) {
    const result = addToOpenClaim({
      code: row.code,
      modifier: row.modifier,
      units: 1,
      chargeCents: row.cents,
      allowedCents: row.cents,
      schedule: `${scheduleName}, ${year}`,
      note: row.name,
      year,
    });
    setAdded(result.createdClaim ? `${row.code} opened a ${year} claim.` : `${row.code} was added to the open ${year} claim.`);
  }

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Filter</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Find a code, then check every year.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          The table is one year. Type a full code and the years appear under the filters.
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

        {family === "physician" && year === 2024 ? <Note2024 /> : null}
        <div className="mt-6">
          <YearList family={family} code={query.trim()} quiet />
        </div>

        {added ? (
          <p className="mt-4 text-sm text-ink" role="status">
            {added}{" "}
            <Link to="/billing" className="font-medium text-teal">
              Open the claim.
            </Link>{" "}
            The charge is the file amount. A therapy line still needs GP, GO, or GN.
          </p>
        ) : null}
        {failed ? <p className="mt-4 text-sm font-medium text-deep">That file did not load.</p> : null}
        {!file && !failed ? <p className="mt-4 text-sm text-muted">Loading the {year} file.</p> : null}
        {file ? (
          <p className="mt-4 text-sm text-muted">
            {built.total.toLocaleString()} on {scheduleName}, {year}. Showing {listed.length}. Type a code or a word to narrow. Physician amounts are non-facility, non-QP, locality 99.
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line bg-paper-2 text-xs tracking-widest text-muted uppercase">
              <tr>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Description</th>
                <th className="px-3 py-3 font-medium">Schedule</th>
                <th className="px-3 py-3 font-medium">Year</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {listed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted">Nothing on this schedule for that filter.</td>
                </tr>
              ) : (
                listed.map((row) => (
                  <tr key={row.key} className="border-t border-line">
                    <td className="px-3 py-3 font-medium text-ink tabular-nums">{row.code}</td>
                    <td className="px-3 py-3 text-ink">
                      {row.name}
                      <span className="mt-1 block text-muted">{row.note}</span>
                    </td>
                    <td className="px-3 py-3 text-ink">{scheduleName}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{year}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{row.amount ?? "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => add(row)} className="rounded-full bg-teal px-3 py-2 text-sm font-medium text-teal-ink">
                          Add to claim
                        </button>
                        <button type="button" onClick={() => toggle(row)} className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink">
                          {keptIds.has(row.key) ? "Kept" : "Keep"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {built.total > built.rows.length ? (
          <p className="mt-3 text-sm text-muted">The table is holding the first 400 matches. Type a code or a word to narrow.</p>
        ) : null}
        {listed.length < visible.length ? (
          <button type="button" onClick={() => setLimit((value) => value + 40)} className="mt-3 h-11 rounded-full border border-line px-4 text-sm font-medium text-ink">
            Show 40 more
          </button>
        ) : null}

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

function buildRows(file: AnyFile | null, family: Family, query: string, preset: Preset, status: string): { total: number; rows: Shown[] } {
  if (!file) return { total: 0, rows: [] };
  const needle = query.trim().toLowerCase();
  const textOk = (code: string, name: string) => needle.length < 2 || code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);
  const presetOk = (code: string, name: string) => {
    if (preset === "transport") return isTransport(code, name);
    if (preset === "procedure") return isProcedure(code);
    return true;
  };
  const needsQuery = false;

  if ("rows" in file && family === "physician" && "localities" in file) {
    const place = file.localities.find((item) => item.mac === "13282" && item.number === "99") ?? null;
    return take(
      file.rows.filter((row) => row.m === "" && (status === "any" || row.s === status) && presetOk(row.c, row.d) && textOk(row.c, row.d) && (!needsQuery || needle.length >= 2)),
      (row) => {
        const label = STATUS_LABEL[row.s] ?? `Status ${row.s}.`;
        let amount: string | null = null;
        let dollars = 0;
        if (notPricedInOffice(row)) {
          amount = NOT_OFFICE_LABEL;
        } else if (payableStatus(row.s)) {
          const conversion = conversionFor(row, "nonQp", file);
          dollars = conversion ? localityDollars(row, "nf", place, conversion) : 0;
          amount = dollars > 0 ? money(dollars) : null;
        }
        return { key: `physician-${file.year}-${row.c}`, code: row.c, modifier: "", name: row.d, note: label, amount, cents: dollars > 0 ? Math.round(dollars * 100) : null };
      },
    );
  }

  if (family === "ambulance" && "rows" in file && file.rows[0] && "carrier" in file.rows[0]) {
    const ambulance = file as AmbulanceFile;
    const mine = ambulance.rows.filter((row) => row.carrier === "13282" && row.loc === "99");
    return take(
      mine.filter((row) => presetOk(row.c, AMBULANCE_NAMES[row.c] ?? "") && textOk(row.c, AMBULANCE_NAMES[row.c] ?? "") && (!needsQuery || needle.length >= 2)),
      (row) => ({
        key: `ambulance-${ambulance.year}-${row.c}`,
        code: row.c,
        modifier: "",
        name: AMBULANCE_NAMES[row.c] ?? row.c,
        note: "Ambulance file, Rest of New York, rural ground.",
        amount: row.rural === null ? null : money(row.rural / 100),
        cents: row.rural,
      }),
    );
  }

  if (family === "lab" && "rows" in file && file.rows[0] && "rate" in file.rows[0]) {
    const lab = file as LabFile;
    return take(
      lab.rows.filter((row) => presetOk(row.c, row.name) && textOk(row.c, row.name) && (!needsQuery || needle.length >= 2)),
      (row) => ({
        key: `lab-${lab.year}-${row.c}-${row.m}`,
        code: row.c,
        modifier: row.m,
        name: row.name,
        note: `Lab file. Indicator ${row.indicator || "blank"}.`,
        amount: row.rate === null ? null : money(row.rate / 100),
        cents: row.rate,
      }),
    );
  }

  if (family === "dme" && "rows" in file && (file.rows.length === 0 || ("rural" in file.rows[0]))) {
    const dme = file as DmeFile;
    return take(
      dme.rows.filter((row) => presetOk(row.c, row.name) && textOk(row.c, row.name) && (!needsQuery || needle.length >= 2)),
      (row) => ({
        key: `dme-${dme.year}-${row.c}-${row.m}-${row.m2}`,
        code: row.c,
        modifier: row.m,
        name: row.name || "No description in the file.",
        note: row.m2 ? `New York rural DME. Second modifier ${row.m2} is not on the claim line.` : "New York rural DME.",
        amount: row.rural === null ? null : money(row.rural / 100),
        cents: row.rural,
      }),
    );
  }

  return { total: 0, rows: [] };
}

function take<T>(rows: T[], map: (row: T) => Shown): { total: number; rows: Shown[] } {
  return { total: rows.length, rows: rows.slice(0, 400).map(map) };
}

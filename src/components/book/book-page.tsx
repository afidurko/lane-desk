import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { GapRates } from "@/components/book/gap-rates";
import { OtherRates } from "@/components/book/other-rates";
import { Shell } from "@/components/landing/shell";
import { AMBULANCE_NAMES, ambulancePlaces, type AmbulanceFile, type AmbulanceRow } from "@/lib/book/ambulance";
import { admit, SCHEDULES, scheduleOf, type AddedRow } from "@/lib/book/book";
import { PAYMENT_SYSTEMS } from "@/lib/book/catalog";
import { type DmeFile, type DmeRow, type LabFile, type LabRow } from "@/lib/book/other";
import { readAdded, writeAdded } from "@/lib/book/store";
import {
  conversionFor,
  localityDollars,
  sequester,
  sequestrationLabel,
  sequestrationPercent,
  SEQUESTRATION,
  type PfsFile,
  type PfsRow,
} from "@/lib/book/price";
import { YearList } from "@/components/lookup/year-lookup";
import { money } from "@/lib/desk/clock";

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const STATUS: Record<string, string> = {
  A: "Active",
  B: "Bundled",
  C: "Contractor priced",
  E: "Excluded",
  I: "Not valid for Medicare",
  J: "Anesthesia",
  M: "Measurement",
  N: "Non-covered",
  P: "Bundled or excluded",
  R: "Restricted",
  T: "Injections",
  X: "Statutory exclusion",
};

function cents(value: number | null) {
  return value === null ? "n/a" : money(value / 100);
}

export function BookPage() {
  const cache = useRef(new Map<string, PfsFile | AmbulanceFile | LabFile | DmeFile>());
  const [family, setFamily] = useState<"physician" | "ambulance" | "lab" | "dme">("physician");
  const [year, setYear] = useState(2026);
  const [date, setDate] = useState("2026-07-01");
  const [file, setFile] = useState<PfsFile | AmbulanceFile | LabFile | DmeFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [setting, setSetting] = useState<"nf" | "fac">("nf");
  const [clinician, setClinician] = useState<"nonQp" | "qp">("nonQp");
  const [locality, setLocality] = useState("13282/99");
  const [modifier, setModifier] = useState("blank");
  const [selected, setSelected] = useState<PfsRow | null>(null);
  const [placeKey, setPlaceKey] = useState("13282/99");
  const [ground, setGround] = useState<"urban" | "rural" | "quartile">("urban");
  const [dmeSide, setDmeSide] = useState<"rural" | "nr">("rural");
  const [added, setAdded] = useState<AddedRow[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addSchedule, setAddSchedule] = useState("waiver");
  const [addYear, setAddYear] = useState("2026");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAdded(readAdded());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeAdded(added);
  }, [added, ready]);

  useEffect(() => {
    const key = `${family}-${year}`;
    const cached = cache.current.get(key);
    if (cached) {
      setFile(cached);
      setFailed(false);
      return;
    }
    setFile(null);
    const path =
      family === "physician"
        ? `/pfs-${year}.json`
        : family === "ambulance"
          ? `/afs-${year}.json`
          : family === "lab"
            ? `/clfs-${year}.json`
            : `/dme-${year}.json`;
    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<PfsFile | AmbulanceFile | LabFile | DmeFile>;
      })
      .then((next) => {
        cache.current.set(key, next);
        setFile(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [family, year]);

  const kind = file && "family" in file ? (file as { family: string }).family : null;
  const ambulance = kind === "ambulance" ? (file as AmbulanceFile) : null;
  const physician = kind === "physician" ? (file as PfsFile) : null;
  const lab = kind === "lab" ? (file as LabFile) : null;
  const dme = kind === "dme" ? (file as DmeFile) : null;
  const places = ambulance ? ambulancePlaces(ambulance) : [];
  const activePlace = places.find((item) => `${item.carrier}/${item.loc}` === placeKey) ?? places[0];

  const matches = useMemo(() => {
    if (!physician) return [];
    const text = query.trim().toLowerCase();
    if (text.length < 2) return [];
    return physician.rows
      .filter((row) => {
        if (modifier === "blank" && row.m !== "") return false;
        if (modifier === "only" && row.m === "") return false;
        return row.c.toLowerCase().includes(text) || row.d.toLowerCase().includes(text);
      })
      .slice(0, 40);
  }, [physician, query, modifier]);

  const place =
    physician && locality !== "national"
      ? (physician.localities.find((item) => `${item.mac}/${item.number}` === locality) ?? null)
      : null;
  const percent = sequestrationPercent(date);

  function priceOf(row: PfsRow) {
    if (!physician) return null;
    const mode = physician.conversion.qp ? clinician : "nonQp";
    const conversion = conversionFor(row, mode, physician);
    if (!conversion) return null;
    const allowed = localityDollars(row, setting, place, conversion);
    return allowed > 0 ? allowed : null;
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const result = admit({ code: addCode, name, year: addYear, scheduleId: addSchedule, amount, source, added });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setAdded((current) => [result.row, ...current]);
    setMessage(null);
    setName("");
    setAmount("");
    setSource("");
  }

  const shown = selected ?? matches[0] ?? null;
  const allowed = shown && physician ? priceOf(shown) : null;
  const cut = allowed !== null && percent !== null ? sequester(allowed, percent) : null;
  const trip = ambulance && activePlace
    ? ambulance.rows.filter((row) => row.carrier === activePlace.carrier && row.loc === activePlace.loc)
    : [];
  const pickedTrip = trip.find((row) => row.c.toLowerCase().includes(query.trim().toLowerCase())) ?? trip[0];

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Codes</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Medicare fee schedules from 2020 through 2026, then the sequestration rate for the date of service.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Physician, ambulance, clinical lab, and New York DMEPOS files are the federal schedules, priced for Rest of New York. New York Medicaid fee-for-service is on the New York page. PACE capitation is not a row in either.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-ink">
            Schedule
            <select
              value={family}
              onChange={(event) => {
                setFamily(event.target.value as "physician" | "ambulance" | "lab" | "dme");
                setQuery("");
                setSelected(null);
              }}
              className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base"
            >
              <option value="physician">Physician</option>
              <option value="ambulance">Ambulance</option>
              <option value="lab">Clinical lab</option>
              <option value="dme">DMEPOS, New York</option>
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Year
            <select
              value={year}
              onChange={(event) => {
                const next = Number(event.target.value);
                setYear(next);
                setDate(`${next}-07-01`);
                setSelected(null);
                setClinician("nonQp");
              }}
              className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base"
            >
              {YEARS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Date of service
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
          </label>
          <p className="self-end text-sm leading-relaxed text-muted">{sequestrationLabel(date)} The fee itself does not change.</p>
        </div>
        {failed ? <p className="mt-3 text-sm font-medium text-deep">That file did not load.</p> : null}
        {!file && !failed ? <p className="mt-3 text-sm text-muted">Loading the {year} file.</p> : null}

        {physician ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-ink sm:col-span-2">
                Code or short description
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="97110 or gait" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
              </label>
              <label className="text-sm font-medium text-ink">
                Setting
                <select value={setting} onChange={(event) => setSetting(event.target.value as "nf" | "fac")} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
                  <option value="nf">Non-facility</option>
                  <option value="fac">Facility</option>
                </select>
              </label>
              <label className="text-sm font-medium text-ink">
                Clinician
                <select value={clinician} onChange={(event) => setClinician(event.target.value as "nonQp" | "qp")} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
                  <option value="nonQp">Non-QP, {physician.conversion.nonQp}</option>
                  <option value="qp" disabled={!physician.conversion.qp}>QP{physician.conversion.qp ? `, ${physician.conversion.qp}` : ", not a separate factor this year"}</option>
                </select>
              </label>
              <label className="text-sm font-medium text-ink sm:col-span-2">
                Where was the service
                <select value={locality} onChange={(event) => setLocality(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
                  <option value="national">National, GPCI 1.000</option>
                  {physician.localities.map((item) => (
                    <option key={`${item.mac}-${item.number}`} value={`${item.mac}/${item.number}`}>
                      {item.mac} {item.state ? `${item.state} ` : ""}{item.number} {item.name}
                      {item.mac === "13282" && item.number === "99" ? " — Olean, 14760" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-ink">
                Modifier
                <select value={modifier} onChange={(event) => setModifier(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
                  <option value="blank">No modifier</option>
                  <option value="only">Modifier rows only</option>
                  <option value="all">All rows</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-sm text-muted">
              {physician.rows.length.toLocaleString()} codes. Default is Olean, ZIP 14760, Cattaraugus County. That is Rest of New York, MAC 13282, locality 99. Work GPCI {place?.work ?? "1.000"}, practice expense {place?.pe ?? "1.000"}, malpractice {place?.mp ?? "1.000"}.
            </p>
            <div className="mt-6">
              <YearList family={family} code={query} quiet />
            </div>
            <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
              <ul className="overflow-hidden rounded-2xl border border-line">
                {matches.length === 0 ? (
                  <li className="px-4 py-4 text-sm text-muted">No match yet. An empty search is not a price.</li>
                ) : (
                  matches.map((row) => {
                    const value = priceOf(row);
                    const active = shown?.c === row.c && shown?.m === row.m;
                    return (
                      <li key={`${row.c}-${row.m}`} className="border-t border-line first:border-t-0">
                        <button type="button" onClick={() => setSelected(row)} className={active ? "w-full bg-paper-2 px-4 py-3 text-left" : "w-full px-4 py-3 text-left hover:bg-paper-2"}>
                          <span className="font-medium text-ink tabular-nums">{row.c}{row.m ? `-${row.m}` : ""}</span>
                          <span className="mt-1 block text-sm text-ink">{row.d}</span>
                          <span className="mt-1 block text-xs text-muted">{STATUS[row.s] ?? row.s}. {value === null ? "No national amount" : money(value)}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <section className="rounded-2xl border border-line bg-paper-2 p-5">
                {shown && allowed !== null && cut ? (
                  <>
                    <p className="text-xs font-medium tracking-widest text-teal uppercase">{year} {STATUS[shown.s] ?? shown.s}</p>
                    <h2 className="mt-2 font-display text-3xl text-ink">{shown.c}{shown.m ? ` ${shown.m}` : ""} {shown.d}</h2>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs tracking-widest text-muted uppercase">Fee schedule</dt><dd className="mt-1 font-medium text-ink tabular-nums">{money(allowed)}</dd></div>
                      <div><dt className="text-xs tracking-widest text-muted uppercase">Work / PE / MP</dt><dd className="mt-1 text-ink tabular-nums">{shown.w} / {setting === "nf" ? shown.pn : shown.pf} / {shown.mp}</dd></div>
                      <div><dt className="text-xs tracking-widest text-muted uppercase">Medicare 80%</dt><dd className="mt-1 text-ink tabular-nums">{money(cut.medicare)}</dd></div>
                      <div><dt className="text-xs tracking-widest text-muted uppercase">Sequestration {percent}%</dt><dd className="mt-1 text-ink tabular-nums">{money(cut.cut)}</dd></div>
                      <div><dt className="text-xs tracking-widest text-muted uppercase">Medicare pays</dt><dd className="mt-1 font-medium text-ink tabular-nums">{money(cut.paid)}</dd></div>
                      <div><dt className="text-xs tracking-widest text-muted uppercase">Coinsurance</dt><dd className="mt-1 text-ink tabular-nums">{money(cut.coinsurance)}</dd></div>
                    </dl>
                    <p className="mt-4 text-sm leading-relaxed text-muted">CARC {SEQUESTRATION.carc}. {SEQUESTRATION.source} Part B, deductible already met. Not a payment.</p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-muted">
                    {shown?.s === "J"
                      ? `${anesthesiaNote(physician, shown, place)} Payment is base units plus time, times that factor. This book does not invent the time.`
                      : shown
                        ? `${shown.c} has no amount on this setting.`
                        : "Select a code. Contractor-priced and excluded codes stay blank."}
                  </p>
                )}
              </section>
            </div>
          </>
        ) : null}

        {ambulance && activePlace ? (
          <section className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-ink">
                Carrier locality
                <select value={`${activePlace.carrier}/${activePlace.loc}`} onChange={(event) => setPlaceKey(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
                  {places.map((item) => (
                    <option key={`${item.carrier}/${item.loc}`} value={`${item.carrier}/${item.loc}`}>{item.carrier} / {item.loc}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-ink">
                Ground setting
                <select value={ground} onChange={(event) => setGround(event.target.value as "urban" | "rural" | "quartile")} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                  <option value="quartile">Rural lowest quartile</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{ambulance.source}</p>
            <ul className="mt-4 overflow-hidden rounded-2xl border border-line">
              {trip.map((row) => (
                <AmbulanceLine key={row.c} row={row} ground={ground} percent={percent} active={pickedTrip?.c === row.c} />
              ))}
            </ul>
          </section>
        ) : null}

        {family !== "physician" ? (
          <div className="mt-6">
            <YearList family={family} code={query} quiet />
          </div>
        ) : null}
        {lab ? <LabList rows={lab.rows} query={query} onQuery={setQuery} source={lab.source} percent={percent} /> : null}
        {dme ? <DmeList rows={dme.rows} query={query} onQuery={setQuery} source={dme.source} percent={percent} side={dmeSide} onSide={setDmeSide} /> : null}

        <OtherRates />
        <GapRates />

        <section className="mt-10 grid items-start gap-6 lg:grid-cols-2">
          <form onSubmit={add} className="rounded-2xl border border-line bg-paper-2 p-5">
            <h2 className="font-display text-3xl text-ink">Add a row these files do not have</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Medicaid and waiver rates are not CMS physician or ambulance files. A row needs a source and stays in this browser.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-ink">
                Schedule
                <select value={addSchedule} onChange={(event) => { const next = event.target.value; setAddSchedule(next); const found = scheduleOf(next); if (found) setAddYear(String(found.year)); }} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3">
                  {SCHEDULES.filter((item) => !item.loaded).map((item) => (
                    <option key={item.id} value={item.id}>{item.year} {item.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-ink">
                Code
                <input value={addCode} onChange={(event) => setAddCode(event.target.value.toUpperCase())} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3" />
              </label>
              <label className="text-sm font-medium text-ink sm:col-span-2">
                Service name
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3" />
              </label>
              <label className="text-sm font-medium text-ink">
                Allowed dollars
                <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3" />
              </label>
              <label className="text-sm font-medium text-ink">
                Source
                <input value={source} onChange={(event) => setSource(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3" />
              </label>
            </div>
            {message ? <p className="mt-3 text-sm font-medium text-deep" role="alert">{message}</p> : null}
            <button type="submit" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">Keep this row</button>
          </form>
          <div>
            <h2 className="font-display text-3xl text-ink">Payment systems</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">A loaded row has a CMS rate file in this app. The rest are named so they are not mistaken for a price.</p>
            <ul className="mt-4 space-y-3">
              {PAYMENT_SYSTEMS.map((item) => (
                <li key={item.name} className="rounded-2xl border border-line p-4">
                  <h3 className="font-display text-2xl text-ink">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.loaded ?? item.gap}</p>
                  {item.loaded && item.gap ? <p className="mt-1 text-sm leading-relaxed text-muted">{item.gap}</p> : null}
                </li>
              ))}
            </ul>
            {added.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {added.map((row) => (
                  <li key={row.id} className="text-sm text-ink">{row.code} {row.name}. {money(row.unitDollars)}. {row.source}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-4 text-sm text-muted">
              The note clock reads the 2026 physical, occupational, and speech therapy codes. <Link to="/desk" className="font-medium text-teal">Open the desk.</Link>
            </p>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function anesthesiaNote(file: PfsFile, row: PfsRow, locality: PfsFile["localities"][number] | null) {
  if (row.s !== "J") return "";
  if (!locality) {
    const header = (file.anesthesiaHeader ?? []).map((item) => item.trim()).filter(Boolean).join(" ");
    return header || "Anesthesia uses a conversion factor, not the physician RVU total.";
  }
  const match = (file.anesthesia ?? []).find((item) => item.mac === locality.mac && item.number === locality.number);
  return match ? `Locality conversion factor ${match.rates.join(", ")}.` : "No anesthesia conversion factor for this locality.";
}

function dollars(value: number | null) {
  return value === null ? "n/a" : money(value / 100);
}

function LabList({ rows, query, onQuery, source, percent }: { rows: LabRow[]; query: string; onQuery: (value: string) => void; source: string; percent: number | null }) {
  const text = query.trim().toLowerCase();
  const matches = text.length < 2 ? [] : rows.filter((row) => row.c.toLowerCase().includes(text) || row.name.toLowerCase().includes(text)).slice(0, 40);
  const shown = matches[0];
  const cut = shown && shown.rate !== null && percent !== null ? sequester(shown.rate / 100, percent) : null;
  return (
    <section className="mt-6">
      <label className="text-sm font-medium text-ink">
        Code or short description
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="80053 or metabolic" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
      </label>
      <p className="mt-3 text-sm leading-relaxed text-muted">{rows.length.toLocaleString()} codes. {source}</p>
      <ul className="mt-4 overflow-hidden rounded-2xl border border-line">
        {matches.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted">No match yet.</li>
        ) : (
          matches.map((row) => (
            <li key={`${row.c}-${row.m}`} className="border-t border-line px-4 py-3 first:border-t-0">
              <p className="font-medium text-ink tabular-nums">{row.c}{row.m ? `-${row.m}` : ""} {row.name}</p>
              <p className="mt-1 text-sm text-ink">Rate {dollars(row.rate)}. Indicator {row.indicator || "blank"}.</p>
            </li>
          ))
        )}
      </ul>
      {shown && cut ? (
        <p className="mt-3 text-sm text-muted">
          If {shown.c} were the allowed amount and the deductible were met, Medicare pays {money(cut.paid)} after {percent}% sequestration. Not a payment.
        </p>
      ) : null}
    </section>
  );
}

function DmeList({ rows, query, onQuery, source, percent, side, onSide }: { rows: DmeRow[]; query: string; onQuery: (value: string) => void; source: string; percent: number | null; side: "rural" | "nr"; onSide: (value: "rural" | "nr") => void }) {
  const text = query.trim().toLowerCase();
  const matches = text.length < 2 ? [] : rows.filter((row) => row.c.toLowerCase().includes(text) || row.name.toLowerCase().includes(text)).slice(0, 40);
  return (
    <section className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">
          Code
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="E0601 or oxygen" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
        </label>
        <label className="text-sm font-medium text-ink">
          New York column
          <select value={side} onChange={(event) => onSide(event.target.value as "rural" | "nr")} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
            <option value="rural">Rural, ZIP 14760</option>
            <option value="nr">Non-rural</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{rows.length.toLocaleString()} codes. {source}</p>
      <ul className="mt-4 overflow-hidden rounded-2xl border border-line">
        {rows.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted">No fee rows in this file.</li>
        ) : matches.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted">No match yet.</li>
        ) : (
          matches.map((row) => {
            const amount = side === "rural" ? row.rural : row.nr;
            const cut = amount !== null && percent !== null ? sequester(amount / 100, percent) : null;
            return (
              <li key={`${row.c}-${row.m}-${row.m2}`} className="border-t border-line px-4 py-3 first:border-t-0">
                <p className="font-medium text-ink tabular-nums">{row.c}{row.m ? ` ${row.m}` : ""}{row.m2 ? ` ${row.m2}` : ""} {row.name}</p>
                <p className="mt-1 text-sm text-ink">
                  {side === "rural" ? "New York rural" : "New York non-rural"} {dollars(amount)}. Ceiling {dollars(row.ceiling)}. Floor {dollars(row.floor)}.
                </p>
                {cut ? <p className="mt-1 text-xs text-muted">If this were allowed and the deductible were met, Medicare pays {money(cut.paid)} after {percent}% sequestration. Not a payment.</p> : null}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

function AmbulanceLine({ row, ground, percent, active }: { row: AmbulanceRow; ground: "urban" | "rural" | "quartile"; percent: number | null; active: boolean }) {
  const amount = ground === "urban" ? row.urban : ground === "rural" ? row.rural : row.quartile;
  const cut = amount !== null && percent !== null ? sequester(amount / 100, percent) : null;
  return (
    <li className={active ? "border-t border-line bg-paper-2 px-4 py-3 first:border-t-0" : "border-t border-line px-4 py-3 first:border-t-0"}>
      <p className="font-medium text-ink tabular-nums">{row.c} {AMBULANCE_NAMES[row.c] ?? ""}</p>
      <p className="mt-1 text-sm text-ink">Published {cents(amount)}. RVU {row.rvu}. GPCI {row.gpci}.</p>
      {cut ? (
        <p className="mt-1 text-xs text-muted">
          If this were the allowed amount and the deductible were met, Medicare’s 80 percent is {money(cut.medicare)}, sequestration is {money(cut.cut)}, and Medicare pays {money(cut.paid)}. Mileage is per mile. Not a payment.
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted">No amount in this column.</p>
      )}
    </li>
  );
}

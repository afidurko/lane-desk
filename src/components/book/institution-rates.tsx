import { useEffect, useState } from "react";
import { money } from "@/lib/desk/clock";

const YEARS = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020];

type SnfRow = {
  group: string;
  pt: string;
  ptCents: number | null;
  ot: string;
  otCents: number | null;
  slp: string;
  slpCents: number | null;
  nursing: string;
  nursingIndex: string;
  nursingCents: number | null;
  nta: string;
  ntaCents: number | null;
};

type YearFile = {
  ipps: { year: number; source: string; rows: { drg: string; title: string; weight: string }[]; laborAtOrBelowOne?: number; nonlaborAtOrBelowOne?: number } | null;
  snf: { year: number; source: string; rural: SnfRow[]; urban: SnfRow[] } | null;
  irf: { year: number; source: string; rows: { cmg: string; name: string; t1: string; t2: string; t3: string; none: string }[] } | null;
  hh: { year: number; source: string; rows: { hipps: string; name: string; weight: string; lupa: number }[] } | null;
  hospice: { year: number; source: string; ruralNewYorkIndex?: string; capCents?: number; rates?: { code: string; name: string; cents: number; hourly?: number | null }[] } | null;
  ltch: { asOf: string; rows: { drg: string; title: string; weight: string }[] } | null;
  ipf: { comorbidity?: [string, string][]; ectCents?: number } | null;
};

function part(label: string, index: string, cents: number | null) {
  return `${label} ${index}${cents == null ? "" : `, ${money(cents / 100)}`}`;
}

async function readYear(year: number): Promise<YearFile> {
  async function one<T>(name: string): Promise<T | null> {
    const response = await fetch(`/institution/${name}-${year}.json`);
    return response.ok ? (response.json() as Promise<T>) : null;
  }
  const [ipps, snf, irf, hh, hospice, current] = await Promise.all([
    one<NonNullable<YearFile["ipps"]>>("ipps"),
    one<NonNullable<YearFile["snf"]>>("snf"),
    one<NonNullable<YearFile["irf"]>>("irf"),
    one<NonNullable<YearFile["hh"]>>("hh"),
    one<NonNullable<YearFile["hospice"]>>("hospice"),
    year === 2027 ? fetch("/institution.json").then((response) => (response.ok ? response.json() : null)) : Promise.resolve(null),
  ]);
  return { ipps, snf, irf, hh, hospice, ltch: current?.ltch ?? null, ipf: current?.ipf ?? null };
}

export function InstitutionRates() {
  const [year, setYear] = useState(2027);
  const [rural, setRural] = useState(true);
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<YearFile | null>(null);

  useEffect(() => {
    let stop = false;
    readYear(year).then((next) => {
      if (!stop) setFile(next);
    });
    return () => {
      stop = true;
    };
  }, [year]);

  const code = query.trim().toUpperCase();
  const snfRows = file?.snf ? (rural ? file.snf.rural : file.snf.urban) : [];
  const snf = code ? snfRows.filter((row) => row.group === code || row.nursing === code) : [];
  const irf = code && file?.irf ? file.irf.rows.filter((row) => row.cmg === code) : [];
  const drg = code.length === 3 ? code.padStart(3, "0") : "";
  const ipps = drg && file?.ipps ? file.ipps.rows.filter((row) => row.drg === drg) : [];
  const ltch = drg && file?.ltch ? file.ltch.rows.filter((row) => row.drg === drg) : [];
  const home = code && file?.hh ? file.hh.rows.filter((row) => row.hipps === code) : [];
  const asked = code.length > 0;
  const none = asked && snf.length + irf.length + ipps.length + ltch.length + home.length === 0;

  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl text-ink">Institutional groups</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Each year is its own file. A weight is not a dollar. Skilled nursing amounts on one row are separate components, not a total. Home health is a calendar year. The others are fiscal years.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {YEARS.map((item) => (
          <button key={item} type="button" aria-pressed={item === year} onClick={() => setYear(item)} className={item === year ? "h-10 rounded-full bg-ink px-3 text-sm font-medium text-paper" : "h-10 rounded-full border border-line px-3 text-sm font-medium text-ink"}>
            {item}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium text-ink">
        Group
        <input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="A, ES3, 0101, 001, 1FC11" className="mt-1.5 h-12 w-full max-w-xs rounded-xl border border-line bg-paper-2 px-3 text-base uppercase" />
      </label>
      <button type="button" aria-pressed={rural} onClick={() => setRural((value) => !value)} className="mt-3 h-11 rounded-full border border-line px-4 text-sm font-medium text-ink">
        {rural ? "Rural skilled nursing" : "Urban skilled nursing"}
      </button>
      {file?.hospice?.rates ? (
        <ul className="mt-4 space-y-2">
          {file.hospice.rates.map((row) => (
            <li key={row.name} className="text-sm text-ink">
              {row.code} {row.name}. {money(row.cents / 100)}{row.hourly ? `, ${money(row.hourly / 100)} an hour` : ""}. National rate. Not wage-adjusted.
            </li>
          ))}
        </ul>
      ) : null}
      {file?.ipf?.comorbidity ? (
        <p className="mt-4 text-sm leading-relaxed text-ink">
          Psychiatric comorbidity factors, FY 2027. {file.ipf.comorbidity.map(([name, factor]) => `${name} ${factor}`).join(". ")}. A factor is not a dollar.{file.ipf.ectCents ? ` ECT is ${money(file.ipf.ectCents / 100)} per treatment.` : ""}
        </p>
      ) : null}
      {file?.hospice ? (
        <p className="mt-4 text-sm text-ink">
          Hospice {file.hospice.year}. Rural New York wage index {file.hospice.ruralNewYorkIndex ?? "not in the file"}.
          {file.hospice.capCents ? ` Cap ${money(file.hospice.capCents / 100)}.` : " The cap is not in this file."} An index is not a payment.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">No hospice index file for {year}.</p>
      )}
      {none ? <p className="mt-4 text-sm text-ink">Nothing in the {year} files for that group.</p> : null}
      {!file?.snf && asked ? <p className="mt-3 text-sm text-muted">No skilled nursing file for {year}.</p> : null}
      {snf.map((row) => (
        <div key={`${row.group}-${row.nursing}`} className="mt-4 rounded-2xl border border-line p-5 text-sm leading-relaxed text-ink">
          <p className="text-muted">Skilled nursing, {rural ? "rural" : "urban"}, FY {year}</p>
          <p className="mt-1">{part("PT", row.pt, row.ptCents)}. {part("OT", row.ot, row.otCents)}. {part("SLP", row.slp, row.slpCents)}.</p>
          <p className="mt-1">{part(`Nursing ${row.nursing}`, row.nursingIndex, row.nursingCents)}. {part("NTA", row.nta, row.ntaCents)}.</p>
        </div>
      ))}
      {ipps.map((row) => {
        const national = file?.ipps?.laborAtOrBelowOne != null && file.ipps.nonlaborAtOrBelowOne != null
          ? Math.round(Number(row.weight) * (file.ipps.laborAtOrBelowOne + file.ipps.nonlaborAtOrBelowOne))
          : null;
        return (
          <div key={row.drg} className="mt-4 rounded-2xl border border-line p-5 text-sm leading-relaxed text-ink">
            <p className="text-muted">Inpatient, FY {year}</p>
            <h3 className="mt-1 font-display text-2xl">MS-DRG {row.drg}</h3>
            <p className="mt-1">{row.title}. Weight {row.weight}.{national != null ? ` Unadjusted ${money(national / 100)} for a wage index at or below 1.` : ""} Not wage-adjusted.</p>
          </div>
        );
      })}
      {!file?.irf && asked ? null : irf.map((row) => (
        <div key={row.cmg} className="mt-4 rounded-2xl border border-line p-5 text-sm leading-relaxed text-ink">
          <p className="text-muted">Inpatient rehabilitation, FY {year}</p>
          <h3 className="mt-1 font-display text-2xl">CMG {row.cmg}</h3>
          <p className="mt-1">{row.name}. Tier weights {row.t1}, {row.t2}, {row.t3}, and {row.none}. Not dollars.</p>
        </div>
      ))}
      {ltch.map((row) => (
        <div key={`ltch-${row.drg}`} className="mt-4 rounded-2xl border border-line p-5 text-sm leading-relaxed text-ink">
          <p className="text-muted">Long-term care hospital, {file?.ltch?.asOf}</p>
          <h3 className="mt-1 font-display text-2xl">MS-LTC-DRG {row.drg}</h3>
          <p className="mt-1">{row.title}. Weight {row.weight}.</p>
        </div>
      ))}
      {home.map((row) => (
        <div key={row.hipps} className="mt-4 rounded-2xl border border-line p-5 text-sm leading-relaxed text-ink">
          <p className="text-muted">Home health, CY {year}</p>
          <h3 className="mt-1 font-display text-2xl">{row.hipps}</h3>
          <p className="mt-1">{row.name}. Weight {row.weight}. LUPA threshold {row.lupa} visits. The weight is not a dollar.</p>
        </div>
      ))}
    </section>
  );
}

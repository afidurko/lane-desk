import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import type { AmbulanceFile } from "@/lib/book/ambulance";
import type { DmeFile, LabFile } from "@/lib/book/other";
import type { PfsFile } from "@/lib/book/price";
import { quoteCode, type Books } from "@/lib/billing/billing";
import { money } from "@/lib/desk/clock";
import { NY, countiesOf, quoteNy, type NyMedicaidFile } from "@/lib/ny/medicaid";
import { extraLabel, quotesMore, type MoreFile } from "@/lib/ny/more";
import { NY_CARE_AFTER, NY_HOSPICE_AFTER, NY_REHAB_ABSENT, NY_SOLD_BOOKS } from "@/lib/ny/local";

const empty: Books = { physician: null, ambulance: null, lab: null, dme: null };
const THERAPY = ["97110", "97161"] as const;
const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"] as const;

type TherapyFile = Record<string, { n?: string; a?: Record<string, number | null> } | undefined>;
type CareRate = { level: string; cents: number };
type CareRow = { name: string; county: string; rates: CareRate[] };
type CareFile = { rows: CareRow[]; later: CareRow[] };

function countyLabel(county: string) {
  return county.toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (_match, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
}

export function NyPage() {
  const [books, setBooks] = useState<Books>(empty);
  const [ny, setNy] = useState<NyMedicaidFile | null>(null);
  const [more, setMore] = useState<MoreFile | null>(null);
  const [therapy, setTherapy] = useState<TherapyFile | null>(null);
  const [care, setCare] = useState<CareFile | null>(null);
  const [code, setCode] = useState("A0428");
  const [county, setCounty] = useState<string>(NY.county);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/pfs-2026.json").then((response) => response.json() as Promise<PfsFile>),
      fetch("/afs-2026.json").then((response) => response.json() as Promise<AmbulanceFile>),
      fetch("/clfs-2026.json").then((response) => response.json() as Promise<LabFile>),
      fetch("/dme-2026.json").then((response) => response.json() as Promise<DmeFile>),
      fetch("/ny-medicaid.json").then((response) => response.json() as Promise<NyMedicaidFile>),
      fetch("/ny-more.json").then((response) => response.json() as Promise<MoreFile>),
      fetch("/years/physician/9.json").then((response) => response.json() as Promise<TherapyFile>),
      fetch("/ny-care-2024.json").then((response) => response.json() as Promise<CareFile>),
    ])
      .then(([physician, ambulance, lab, dme, medicaid, other, years, personal]) => {
        setBooks({ physician, ambulance, lab, dme });
        setNy(medicaid);
        setMore(other);
        setTherapy(years);
        setCare(personal);
      })
      .catch(() => setFailed(true));
  }, []);

  const federal = quoteCode(books, code, "");
  const state = ny ? quoteNy(ny, code, county) : null;
  const others = more ? quotesMore(more, code) : [];
  const counties = ny ? countiesOf(ny) : [NY.county];
  const agencies = (care?.rows ?? []).filter((row) => row.county === county);
  const later = (care?.later ?? []).filter((row) => row.county === county);

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-[13px] text-muted">New York team</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">
          New York.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Pick the county. Olean is Cattaraugus. A rate is used only when the file names that county.
        </p>
        <label className="mt-8 block max-w-md text-sm font-medium text-ink">
          County
          <select value={county} onChange={(event) => setCounty(event.target.value)} className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-3 text-base">
            {counties.map((name) => (
              <option key={name} value={name}>{countyLabel(name)}</option>
            ))}
          </select>
        </label>
        <h2 className="mt-8 text-[22px] font-semibold tracking-tight text-ink">Personal care, {countyLabel(county)}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{NY_CARE_AFTER} The January 1, 2024 workbook names 51 counties. A zero in that workbook is not shown.</p>
        {later.length > 0 ? <CareList title="January 1, 2025" rows={later} /> : null}
        {agencies.length > 0 ? <CareList title="January 1, 2024" rows={agencies} /> : <p className="mt-4 text-sm text-muted">No personal care agency for {countyLabel(county)} is on the January 1, 2024 workbook.</p>}
        <form className="mt-10 max-w-md" onSubmit={(event) => event.preventDefault()}>
          <label className="block text-sm font-medium text-ink">
            Code
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-3 text-base" />
          </label>
        </form>
        {failed ? <p className="mt-4 text-sm font-medium text-deep">A fee file did not load.</p> : null}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">Physician and laboratory fees are the same in every county. Transportation uses the county you pick. These Medicare amounts are locality 99, Rest of New York. They are not Manhattan, Queens, New York City suburbs, or Poughkeepsie.</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-[10px] bg-paper-2 p-5">
            <p className="text-[13px] text-muted">Federal</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">Medicare</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{federal.schedule}</p>
            <p className="mt-3 font-medium text-ink tabular-nums">{federal.allowedCents === null ? "No amount" : money(federal.allowedCents / 100)}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{federal.note}</p>
          </article>
          <article className="rounded-[10px] bg-paper-2 p-5">
            <p className="text-[13px] text-muted">State</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">NY Medicaid</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{state?.schedule ?? "Loading the eMedNY file."}</p>
            <p className="mt-3 font-medium text-ink tabular-nums">{state ? (state.allowedCents === null ? "No amount" : money(state.allowedCents / 100)) : ""}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{state?.note}</p>
          </article>
        </div>
        <h2 className="mt-10 text-[22px] font-semibold tracking-tight text-ink">Other New York manuals</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          These were not in the physician, laboratory, or transportation files. Olean uses the upstate private-duty rate and the rest-of-state doula rate. A rental, facility, downstate, or New York City amount is labeled when the file has one.
        </p>
        <ul className="mt-4 space-y-3">
          {others.length === 0 ? (
            <li className="text-sm text-muted">No row for this code on DME, dental, nurse practitioner, podiatry, vision, hearing, midwife, private duty nursing, nutrition, doula, applied behavior analysis, or ordered ambulatory.</li>
          ) : (
            others.map((row) => (
              <li key={`${row.family}-${row.name}`} className="rounded-[10px] bg-paper-2 px-4 py-3">
                <p className="font-medium text-ink">{row.family}</p>
                <p className="mt-1 text-sm text-ink">{row.name}</p>
                <p className="mt-1 text-sm tabular-nums text-ink">{row.fee === null ? "No dollar fee" : money(row.fee / 100)}{row.extra === null ? "" : `. ${extraLabel(row.family)} ${money(row.extra / 100)}`}</p>
                <p className="mt-1 text-sm text-muted">{row.asOf}</p>
              </li>
            ))
          )}
        </ul>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">{NY_REHAB_ABSENT}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {THERAPY.map((code) => {
            const row = therapy?.[code];
            return (
              <article key={code} className="rounded-[10px] bg-paper-2 p-5">
                <p className="text-[13px] text-muted">Medicare, Rest of New York</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">{code}</h2>
                <p className="mt-1 text-sm text-muted">{row?.n ?? "Loading the physician file."}</p>
                <ul className="mt-3 divide-y divide-line">
                  {YEARS.map((year) => {
                    const cents = row?.a?.[year];
                    return (
                      <li key={year} className="flex items-baseline justify-between gap-3 py-2 text-sm text-ink">
                        <span>{year}</span>
                        <span className="tabular-nums">{typeof cents === "number" ? money(cents / 100) : "No amount"}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">97160 is not on that Medicare file. No amount is shown.</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{NY_HOSPICE_AFTER}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{NY_SOLD_BOOKS}</p>
      </main>
    </Shell>
  );
}

function CareList({ title, rows }: { title: string; rows: CareRow[] }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {rows.map((agency) => (
        <article key={`${title}-${agency.name}`} className="rounded-[10px] bg-paper-2 p-5">
          <p className="text-[13px] text-muted">{title}</p>
          <h3 className="mt-1 text-[17px] font-semibold text-ink">{countyLabel(agency.name)}</h3>
          <ul className="mt-2 divide-y divide-line">
            {agency.rates.map((rate) => (
              <li key={rate.level} className="flex items-baseline justify-between gap-3 py-2 text-sm text-ink">
                <span>{rate.level}</span>
                <span className="tabular-nums">{money(rate.cents / 100)}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

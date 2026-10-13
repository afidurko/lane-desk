import { useEffect, useState } from "react";
import { money } from "@/lib/desk/clock";
import { LOCAL_AS_OF, LOCAL_CARE } from "@/lib/ny/local";

type Drug = { ndc: string; name: string; perUnit: string; unit: string; kind: string };
type Fee = { c: string; name: string; cents: number | null };
type Hospice = { c: string; name: string; base: number | null; total: number | null; intensity: "high" | "low" };
type GapFile = {
  nadac: { asOf: string; source: string; rows: Drug[] };
  dental: { asOf: string; source: string; rows: Fee[] };
  dme: { asOf: string; source: string; rows: Fee[] };
  hospice: { asOf: string; source: string; rows: Hospice[] };
};

type CareRate = { level: string; cents: number };
type LocalPlace = { place: string; county: string; agencies: { name: string; rates: CareRate[] }[] };
type FoundFile = {
  apg: { asOf: string; source: string; rows: { c: string; name: string; cents: number; units: number | null }[] };
  alp: { asOf: string; facility: string; source: string; rows: { rug: string; name: string; code: string; cents: number | null }[] };
  personalCare: { asOf: string; source: string; rows: { name: string; county: string; rates: CareRate[] }[] };
  localCare?: { asOf: string; source: string; places: LocalPlace[] };
  homeHealth: { asOf: string; source: string; rows: { code: string; name: string; cents: number }[] };
};

const HEADLINE = ["3945", "3946", "3947", "3991"];

export function GapRates() {
  const [file, setFile] = useState<GapFile | null>(null);
  const [found, setFound] = useState<FoundFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [intensity, setIntensity] = useState<"high" | "low">("high");
  const [more, setMore] = useState(false);

  useEffect(() => {
    fetch("/gap-rates.json")
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<GapFile>;
      })
      .then(setFile)
      .catch(() => setFailed(true));
    fetch("/found-rates.json")
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<FoundFile>;
      })
      .then(setFound)
      .catch(() => setFailed(true));
  }, []);

  const text = query.trim().toUpperCase();
  const drugs = !file || text.length < 3 ? [] : /^\d{9,11}$/.test(text)
    ? file.nadac.rows.filter((row) => row.ndc === text).slice(0, 8)
    : file.nadac.rows.filter((row) => row.name.toUpperCase().includes(text)).slice(0, 8);
  const dental = !file || !/^D\d{4}$/.test(text) ? null : file.dental.rows.find((row) => row.c === text) ?? null;
  const equipment = !file || !/^[A-Z]\d{4}$/.test(text) ? null : file.dme.rows.find((row) => row.c === text) ?? null;
  const clinic = !found || !/^\d{5}$/.test(text) ? null : found.apg.rows.find((row) => row.c === text) ?? null;
  const hospice = (file?.hospice.rows ?? []).filter((row) => row.intensity === intensity && (more || HEADLINE.includes(row.c)));

  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl text-ink">Olean and Allegany</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Personal care from the January 1, 2024 workbook. Olean is Cattaraugus. The same workbook is loaded for every county it names. Open New York and pick the county. A zero on the sheet is not shown.
      </p>
      {failed ? <p className="mt-3 text-sm font-medium text-deep">The file did not load.</p> : null}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {(LOCAL_CARE).map((place) => (
          <article key={place.place} className="rounded-2xl border border-line p-5">
            <p className="text-xs font-medium tracking-widest text-teal uppercase">{place.county} County</p>
            <h3 className="mt-1 font-display text-3xl text-ink">{place.place}</h3>
            <p className="mt-1 text-sm text-muted">{LOCAL_AS_OF}</p>
            {place.agencies.map((agency) => (
              <div key={agency.name} className="mt-4">
                <p className="text-sm font-medium text-ink">{agency.name}</p>
                <ul className="mt-2 divide-y divide-line">
                  {agency.rates.map((rate) => (
                    <li key={rate.level} className="flex items-baseline justify-between gap-3 py-2 text-sm text-ink">
                      <span>{rate.level}</span>
                      <span className="tabular-nums">{money(rate.cents / 100)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">The January 1, 2025 public sheet does not name Cattaraugus or Allegany. Erie, Chautauqua, and Wyoming rows from that sheet are on the New York page. Another county’s rate is not used.</p>

      <div className="mt-5 rounded-2xl border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-ink">Cattaraugus hospice</h3>
          <div className="flex gap-2">
            {(["high", "low"] as const).map((level) => (
              <button key={level} type="button" onClick={() => setIntensity(level)} className={intensity === level ? "h-11 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink" : "h-11 rounded-full border border-line px-4 text-sm font-medium text-ink"}>
                {level === "high" ? "High intensity" : "Low intensity"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">Rural counties, {file?.hospice.asOf ?? "October 1, 2025 through September 30, 2026"}. The total includes the two add-ons when the sheet applies them.</p>
        <ul className="mt-4 space-y-2">
          {hospice.map((row) => (
            <li key={`${row.intensity}-${row.c}`} className="flex items-baseline justify-between gap-3 text-sm text-ink">
              <span className="min-w-0">{row.c} {row.name}</span>
              <span className="shrink-0 tabular-nums">{row.base == null ? "No base" : money(row.base / 100)}{row.total == null ? "" : ` · with add-ons ${money(row.total / 100)}`}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setMore((value) => !value)} className="mt-4 h-11 rounded-full border border-line px-4 text-sm font-medium text-ink">
          {more ? "Show the four main rates" : "Show the hour-by-hour rates"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-line p-5">
        <h3 className="font-display text-2xl text-ink">Olean Manor assisted living</h3>
        <p className="mt-2 text-sm text-muted">January 1, 2025 rate, Erie wage region. This is the facility rate, not a procedure code.</p>
        <ul className="mt-4 space-y-2">
          {(found?.alp.rows ?? []).map((row) => (
            <li key={row.code + row.rug} className="flex items-baseline justify-between gap-3 text-sm text-ink">
              <span className="min-w-0">{row.rug} {row.name}</span>
              <span className="shrink-0 tabular-nums">{row.cents == null ? "No rate" : money(row.cents / 100)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-line p-5">
        <h3 className="font-display text-2xl text-ink">Home health visit</h3>
        <p className="mt-2 text-sm text-muted">Statewide weighted average, effective September 6, 2024. A physical therapy visit is revenue code 0421. It is not procedure 97110.</p>
        <ul className="mt-4 space-y-2">
          {(found?.homeHealth.rows ?? []).map((row) => (
            <li key={row.code} className="flex items-baseline justify-between gap-3 text-sm text-ink">
              <span className="min-w-0">{row.code} {row.name}</span>
              <span className="shrink-0 tabular-nums">{money(row.cents / 100)}</span>
            </li>
          ))}
        </ul>
      </div>

      <label className="mt-6 block max-w-md text-sm font-medium text-ink">
        Drug name, NDC, dental code, or equipment code
        <input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} placeholder="LISINOPRIL, D0120, or A4258" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
      </label>
      <ul className="mt-4 space-y-3">
        {drugs.map((row) => (
          <li key={row.ndc} className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">
            {row.name}. NDC {row.ndc}. {row.kind}. ${row.perUnit} per {row.unit}. Acquisition cost for the week of October 7, 2026. Not a payment.
          </li>
        ))}
        {dental ? <li className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">Workers’ compensation dental. {dental.c} {dental.name}. {dental.cents == null ? "No fee" : money(dental.cents / 100)}. Effective November 13, 2025.</li> : null}
        {equipment ? <li className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">Workers’ compensation equipment. {equipment.c} {equipment.name}. {equipment.cents == null ? "No fee" : money(equipment.cents / 100)}. Effective June 28, 2024.</li> : null}
        {clinic ? <li className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">Clinic procedure on the APG fee schedule. {clinic.c} {clinic.name}. {money(clinic.cents / 100)}{clinic.units ? `, max ${clinic.units}` : ""}. July 1, 2026. Not a visit rate.</li> : null}
        {text.length >= 3 && drugs.length === 0 && !dental && !equipment && !clinic ? <li className="text-sm text-muted">No row in the October 7 acquisition file, the workers’ compensation dental file, the equipment file, or the July 1, 2026 clinic procedure list.</li> : null}
      </ul>
    </section>
  );
}

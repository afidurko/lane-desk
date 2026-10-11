import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import type { AmbulanceFile } from "@/lib/book/ambulance";
import type { DmeFile, LabFile } from "@/lib/book/other";
import type { PfsFile } from "@/lib/book/price";
import { quoteCode, type Books } from "@/lib/billing/billing";
import { money } from "@/lib/desk/clock";
import { countiesOf, NY, quoteNy, type NyMedicaidFile } from "@/lib/ny/medicaid";
import { extraLabel, quotesMore, type MoreFile } from "@/lib/ny/more";

const empty: Books = { physician: null, ambulance: null, lab: null, dme: null };

export function NyPage() {
  const [books, setBooks] = useState<Books>(empty);
  const [ny, setNy] = useState<NyMedicaidFile | null>(null);
  const [more, setMore] = useState<MoreFile | null>(null);
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
    ])
      .then(([physician, ambulance, lab, dme, medicaid, other]) => {
        setBooks({ physician, ambulance, lab, dme });
        setNy(medicaid);
        setMore(other);
      })
      .catch(() => setFailed(true));
  }, []);

  const federal = quoteCode(books, code, "");
  const state = ny ? quoteNy(ny, code, county) : null;
  const others = more ? quotesMore(more, code) : [];

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">New York</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Federal Medicare for Rest of New York, beside the New York Medicaid fee.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          {NY.place} is in {NY.county} County. Medicare uses {NY.medicare}. Medicaid uses the eMedNY fee-for-service file for that county when the code is transportation, and the statewide physician or lab file otherwise. A managed-care plan rate is not in these files. PACE capitation is not either.
        </p>
        <form className="mt-8 grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <label className="text-sm font-medium text-ink">
            Code
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
          </label>
          <label className="text-sm font-medium text-ink">
            Medicaid county
            <select value={county} onChange={(event) => setCounty(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              {(ny ? countiesOf(ny) : [NY.county]).map((item) => (
                <option key={item} value={item}>{item}{item === NY.county ? " — Olean" : ""}</option>
              ))}
            </select>
          </label>
        </form>
        {failed ? <p className="mt-4 text-sm font-medium text-deep">A fee file did not load.</p> : null}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-line p-5">
            <p className="text-xs font-medium tracking-widest text-teal uppercase">Federal</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Medicare</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{federal.schedule}</p>
            <p className="mt-3 font-medium text-ink tabular-nums">{federal.allowedCents === null ? "No amount" : money(federal.allowedCents / 100)}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{federal.note}</p>
          </article>
          <article className="rounded-2xl border border-line p-5">
            <p className="text-xs font-medium tracking-widest text-teal uppercase">State</p>
            <h2 className="mt-2 font-display text-3xl text-ink">NY Medicaid</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{state?.schedule ?? "Loading the eMedNY file."}</p>
            <p className="mt-3 font-medium text-ink tabular-nums">{state ? (state.allowedCents === null ? "No amount" : money(state.allowedCents / 100)) : ""}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{state?.note}</p>
          </article>
        </div>
        <h2 className="mt-10 font-display text-3xl text-ink">Other New York manuals</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          These were not in the physician, laboratory, or transportation files. Olean uses the upstate private-duty rate and the rest-of-state doula rate. A rental, facility, downstate, or New York City amount is labeled when the file has one.
        </p>
        <ul className="mt-4 space-y-3">
          {others.length === 0 ? (
            <li className="text-sm text-muted">No row for this code on DME, dental, nurse practitioner, podiatry, vision, hearing, midwife, private duty nursing, nutrition, doula, applied behavior analysis, or ordered ambulatory.</li>
          ) : (
            others.map((row) => (
              <li key={`${row.family}-${row.name}`} className="rounded-2xl border border-line px-4 py-3">
                <p className="font-medium text-ink">{row.family}</p>
                <p className="mt-1 text-sm text-ink">{row.name}</p>
                <p className="mt-1 text-sm tabular-nums text-ink">{row.fee === null ? "No dollar fee" : money(row.fee / 100)}{row.extra === null ? "" : `. ${extraLabel(row.family)} ${money(row.extra / 100)}`}</p>
                <p className="mt-1 text-sm text-muted">{row.asOf}</p>
              </li>
            ))
          )}
        </ul>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
          97110 is on the Medicare Rest of New York file. It is not in the eMedNY physician sections, and it is not in these other workbooks. The rehabilitation manual is a January 2026 policy PDF with no dollar table. Clinic, personal care, home health, hospice, chiropractic, and assisted living manuals are posted, and those pages had no fee workbook.
        </p>
      </main>
    </Shell>
  );
}

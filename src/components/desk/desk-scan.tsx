import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AmbulanceFile } from "@/lib/book/ambulance";
import type { DmeFile, LabFile } from "@/lib/book/other";
import { Note2024 } from "@/components/lookup/year-lookup";
import { NOT_OFFICE_LABEL, NOT_PAID_LABEL, sequestrationLabel } from "@/lib/book/price";
import type { PfsFile } from "@/lib/book/price";
import { claimGuards } from "@/lib/billing/guard";
import { nextGap } from "@/lib/billing/packet";
import { readBilling } from "@/lib/billing/store";
import { readSubmitter } from "@/lib/billing/submitter";
import { money } from "@/lib/desk/clock";
import { scanAmbulance, scanDme, scanLab, scanNeeds2024Note, scanPhysician, type ScanCard, type ScanChange } from "@/lib/desk/scan";

type ClaimRow = { id: string; title: string; detail: string };

function todayIso() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function cents(value: number | null, notOffice?: boolean, notPaid?: boolean) {
  if (notPaid) return NOT_PAID_LABEL;
  if (notOffice) return NOT_OFFICE_LABEL;
  return value === null ? "Not on that file" : money(value / 100);
}

export function DeskScan() {
  const [cards, setCards] = useState<ScanCard[]>([]);
  const [changes, setChanges] = useState<ScanChange[]>([]);
  const [schedule, setSchedule] = useState<"All" | ScanChange["schedule"]>("All");
  const [limit, setLimit] = useState(25);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [failed, setFailed] = useState(false);
  const date = todayIso();
  const visible = schedule === "All" ? changes : changes.filter((row) => row.schedule === schedule);
  const listed = visible.slice(0, limit);

  useEffect(() => {
    const book = readBilling();
    const submitter = readSubmitter();
    setClaims(
      book.claims.slice(0, 4).map((claim) => {
        const client = book.clients.find((item) => item.id === claim.clientId) ?? null;
        const guards = claimGuards(claim, null, todayIso());
        const gap = nextGap(claim, client, submitter, guards.length);
        return {
          id: claim.id,
          title: `${claim.number || "No number"} · ${claim.dos} · ${claim.status}`,
          detail: `${claim.lines.length} line${claim.lines.length === 1 ? "" : "s"}. ${gap.title}.`,
        };
      }),
    );

    const load = (path: string) => fetch(path).then((response) => {
      if (!response.ok) throw new Error(path);
      return response.json();
    });
    Promise.all([
      load("/pfs-2026.json") as Promise<PfsFile>,
      load("/pfs-2025.json") as Promise<PfsFile>,
      load("/afs-2026.json") as Promise<AmbulanceFile>,
      load("/afs-2025.json") as Promise<AmbulanceFile>,
      load("/clfs-2026.json") as Promise<LabFile>,
      load("/clfs-2025.json") as Promise<LabFile>,
      load("/dme-2026.json") as Promise<DmeFile>,
      load("/dme-2025.json") as Promise<DmeFile>,
    ])
      .then(([physician, priorPhysician, ambulance, priorAmbulance, lab, priorLab, dme, priorDme]) => {
        const scans = [
          scanPhysician(physician, priorPhysician),
          scanAmbulance(ambulance, priorAmbulance),
          scanLab(lab, priorLab),
          scanDme(dme, priorDme),
        ];
        setCards(scans.map((scan) => scan.card));
        setChanges(scans.flatMap((scan) => scan.changes));
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <section className="mt-8">
      <p className="text-xs font-medium tracking-widest text-teal uppercase">Scan · 2025 against 2026</p>
      <h2 className="mt-2 font-display text-3xl text-ink">What changed on the loaded files.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Rest of New York, MAC 13282, locality 99. Physician amounts are non-facility, non-QP. Ambulance and DME use the rural amount. {sequestrationLabel(date)} Not a payment.
      </p>
      {failed ? <p className="mt-4 text-sm font-medium text-deep">A 2025 or 2026 file did not load. The note clock can still run.</p> : null}
      {cards.length === 0 && !failed ? <p className="mt-4 text-sm text-muted">Reading the 2025 and 2026 files.</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.schedule} className="rounded-2xl border border-line bg-paper-2 p-4">
            <p className="text-xs font-medium tracking-widest text-muted uppercase">{card.schedule}</p>
            <p className="mt-2 font-display text-3xl text-ink tabular-nums">{card.changed.toLocaleString()}</p>
            <p className="mt-1 text-sm text-ink">changed of {card.compared.toLocaleString()} compared</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{card.priorYear} to {card.year}. {card.rows.toLocaleString()} rows on the {card.year} file.</p>
          </article>
        ))}
      </div>
      {scanNeeds2024Note(cards) ? <Note2024 /> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["All", "Physician", "Ambulance", "Lab", "DME"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setSchedule(item);
              setLimit(25);
            }}
            className={item === schedule ? "h-10 rounded-full bg-ink px-4 text-sm font-medium text-paper" : "h-10 rounded-full border border-line px-4 text-sm font-medium text-ink"}
          >
            {item}
          </button>
        ))}
      </div>
      {listed.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Codes whose 2026 amount differs from 2025</caption>
              <thead className="bg-paper-2 text-xs tracking-widest text-muted uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Code</th>
                  <th className="px-3 py-3 font-medium">Schedule</th>
                  <th className="px-3 py-3 font-medium">2025</th>
                  <th className="px-3 py-3 font-medium">2026</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((row) => (
                  <tr key={`${row.schedule}-${row.code}`} className="border-t border-line">
                    <td className="px-3 py-3 text-ink">
                      <span className="font-medium tabular-nums">{row.code}</span>
                      <span className="mt-1 block text-muted">{row.name}</span>
                    </td>
                    <td className="px-3 py-3 text-ink">{row.schedule}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{cents(row.prior, row.priorNotOffice, row.priorNotPaid)}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{cents(row.current, row.currentNotOffice, row.currentNotPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-muted">
            Showing {listed.length} of {visible.length.toLocaleString()} changed codes. A matching fee is not coverage, and it is not a payment.
          </p>
          {listed.length < visible.length ? (
            <button type="button" onClick={() => setLimit((value) => value + 25)} className="mt-3 h-11 rounded-full border border-line px-4 text-sm font-medium text-ink">
              Show 25 more
            </button>
          ) : null}
        </>
      ) : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line p-5">
          <h3 className="font-display text-2xl text-ink">Open claims</h3>
          <ul className="mt-3 space-y-2">
            {claims.length === 0 ? <li className="text-sm text-muted">No claim on this browser yet.</li> : null}
            {claims.map((claim) => (
              <li key={claim.id} className="text-sm text-ink">
                <span className="font-medium">{claim.title}.</span> {claim.detail}
              </li>
            ))}
          </ul>
          <Link to="/billing" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-teal">
            Open a claim
          </Link>
        </article>
        <article className="rounded-2xl border border-line p-5">
          <h3 className="font-display text-2xl text-ink">On this desk</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li>Physician, ambulance, lab, and New York DME files, 2020 through 2026.</li>
            <li>The note clock reads 2026 therapy codes only. Other codes stay on the table.</li>
            <li>A claim is prepared here. It is not sent.</li>
          </ul>
          <Link to="/filter" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-teal">
            Filter every code
          </Link>
        </article>
      </div>
    </section>
  );
}

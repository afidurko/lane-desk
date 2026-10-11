import { useEffect, useState, type FormEvent } from "react";
import { Shell } from "@/components/landing/shell";
import type { AmbulanceFile } from "@/lib/book/ambulance";
import type { DmeFile, LabFile } from "@/lib/book/other";
import { sequester, sequestrationPercent, type PfsFile } from "@/lib/book/price";
import { centsFromDollars, checkClaim, checkClient, claimTotals, quoteCode, type Books, type Claim, type Client, type Line } from "@/lib/billing/billing";
import { buildPacket, packetJson } from "@/lib/billing/packet";
import { claimAlerts } from "@/lib/billing/verify";
import { readSubmitter, writeSubmitter, type Submitter } from "@/lib/billing/submitter";
import { readBilling, writeBilling } from "@/lib/billing/store";
import { InvoiceIntake } from "@/components/billing/invoice-intake";
import { money } from "@/lib/desk/clock";
import { NY, quoteNy, type NyMedicaidFile } from "@/lib/ny/medicaid";

const emptyBooks: Books = { physician: null, ambulance: null, lab: null, dme: null };

export function BillingPage() {
  const [books, setBooks] = useState<Books>(emptyBooks);
  const [ny, setNy] = useState<NyMedicaidFile | null>(null);
  const [payer, setPayer] = useState<"medicare" | "medicaid">("medicare");
  const [clients, setClients] = useState<Client[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState("");
  const [org, setOrg] = useState("");
  const [npi, setNpi] = useState("");
  const [dos, setDos] = useState("2026-07-01");
  const [pos, setPos] = useState("12");
  const [diagnosis, setDiagnosis] = useState("");
  const [code, setCode] = useState("");
  const [modifier, setModifier] = useState("");
  const [units, setUnits] = useState("1");
  const [charge, setCharge] = useState("");
  const [submitter, setSubmitter] = useState<Submitter>({ name: "", npi: "", submitterId: "", receiver: "National Government Services, MAC 13282" });
  const [message, setMessage] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);

  useEffect(() => {
    const saved = readBilling();
    setClients(saved.clients);
    setClaims(saved.claims);
    setClientId(saved.clients[0]?.id ?? "");
    setClaimId(saved.claims[0]?.id ?? null);
    setReady(true);
    setSubmitter(readSubmitter());
    const year = 2026;
    Promise.all([
      fetch(`/pfs-${year}.json`).then((response) => response.json() as Promise<PfsFile>),
      fetch(`/afs-${year}.json`).then((response) => response.json() as Promise<AmbulanceFile>),
      fetch(`/clfs-${year}.json`).then((response) => response.json() as Promise<LabFile>),
      fetch(`/dme-${year}.json`).then((response) => response.json() as Promise<DmeFile>),
      fetch("/ny-medicaid.json").then((response) => response.json() as Promise<NyMedicaidFile>),
    ])
      .then(([physician, ambulance, lab, dme, medicaid]) => {
        setBooks({ physician, ambulance, lab, dme });
        setNy(medicaid);
      })
      .catch(() => setMessage("A fee file did not load. Lines can still be drafted without an allowed amount."));
  }, []);

  useEffect(() => {
    if (ready) writeBilling({ clients, claims });
  }, [clients, claims, ready]);

  const claim = claims.find((item) => item.id === claimId) ?? null;
  const client = clients.find((item) => item.id === (claim?.clientId ?? clientId)) ?? null;
  const totals = claim ? claimTotals(claim.lines) : null;
  const percent = claim ? sequestrationPercent(claim.dos) : null;
  const cut = totals?.allowedCents !== null && totals?.allowedCents !== undefined && percent !== null ? sequester(totals.allowedCents / 100, percent) : null;

  function addClient(event: FormEvent) {
    event.preventDefault();
    const result = checkClient(org, npi);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const next = { id: `org-${Date.now()}`, name: result.name, npi: result.npi };
    setClients((current) => [next, ...current]);
    setClientId(next.id);
    setOrg("");
    setNpi("");
    setMessage(null);
  }

  function addClaim(event: FormEvent) {
    event.preventDefault();
    if (!clientId) {
      setMessage("Add the organization first.");
      return;
    }
    const result = checkClaim(dos, pos, diagnosis);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const next: Claim = {
      id: `claim-${Date.now()}`,
      clientId,
      dos: result.dos,
      pos: result.pos,
      diagnosis: result.diagnosis,
      payer,
      status: "draft",
      lines: [],
    };
    setClaims((current) => [next, ...current]);
    setClaimId(next.id);
    setMessage(null);
  }

  function addLine(event: FormEvent) {
    event.preventDefault();
    if (!claim || claim.status === "ready") return;
    const count = Number(units);
    if (!Number.isInteger(count) || count < 1 || count > 999) {
      setMessage("Units are a whole number from 1 to 999.");
      return;
    }
    const priced = centsFromDollars(charge);
    if (!priced.ok) {
      setMessage(priced.error);
      return;
    }
    const federal = quoteCode(books, code, modifier);
    const state = ny
      ? quoteNy(ny, code, NY.county)
      : { schedule: "NY Medicaid", allowedCents: null, note: "The state file is not loaded." };
    const selected = (claim.payer ?? "medicare") === "medicaid" ? state : federal;
    const other = (claim.payer ?? "medicare") === "medicaid" ? federal : state;
    if (selected.schedule === "none") {
      setMessage(selected.note);
      return;
    }
    const line: Line = {
      id: `line-${Date.now()}`,
      code: code.trim().toUpperCase(),
      modifier: modifier.trim().toUpperCase(),
      units: count,
      chargeCents: priced.cents,
      allowedCents: selected.allowedCents,
      schedule: selected.schedule,
      note: selected.note,
      otherCents: other.allowedCents,
      otherSchedule: other.schedule,
    };
    setClaims((current) => current.map((item) => (item.id === claim.id ? { ...item, lines: [...item.lines, line] } : item)));
    setCode("");
    setModifier("");
    setCharge("");
    setMessage(null);
  }

  function setStatus(status: "draft" | "ready") {
    if (!claim) return;
    setClaims((current) => current.map((item) => (item.id === claim.id ? { ...item, status } : item)));
  }

  function downloadPacket() {
    if (!claim) return;
    const blob = new Blob([packetJson(claim, client, submitter)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${claim.id}-837p.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function download() {
    if (!claim || !client) return;
    const header = "organization,npi,payer,date,place,diagnosis,code,modifier,units,charge,allowed,schedule,other,note";
    const body = claim.lines.map((line) =>
      [
        client.name,
        client.npi,
        claim.payer ?? "medicare",
        claim.dos,
        claim.pos,
        claim.diagnosis,
        line.code,
        line.modifier,
        line.units,
        moneyOrBlank(line.chargeCents, line.units),
        moneyOrBlank(line.allowedCents, line.units),
        line.schedule,
        line.otherCents == null ? "" : money((line.otherCents * line.units) / 100),
        line.note,
      ]
        .map(csv)
        .join(","),
    );
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${claim.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const board = {
    draft: claims.filter((item) => item.status === "draft").length,
    ready: claims.filter((item) => item.status === "ready").length,
  };

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Olean · 14760 · claims</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Build the claim. Hand it to an enrolled submitter.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          This is the desk a PACE program staffs with people. The note is priced for Rest of New York. A complete packet is an 837P for MAC 13282. Transmission needs a submitter ID with National Government Services. This browser does not have one.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-line bg-paper-2 p-5">
            <dt className="text-xs font-medium tracking-widest text-muted uppercase">Draft</dt>
            <dd className="mt-1 font-display text-4xl text-ink tabular-nums">{board.draft}</dd>
          </div>
          <div className="rounded-2xl border border-line bg-paper-2 p-5">
            <dt className="text-xs font-medium tracking-widest text-muted uppercase">Ready to hand off</dt>
            <dd className="mt-1 font-display text-4xl text-ink tabular-nums">{board.ready}</dd>
          </div>
        </dl>

        <form onSubmit={addClient} className="mt-8 grid gap-3 rounded-2xl border border-line bg-paper-2 p-5 sm:grid-cols-2">
          <h2 className="font-display text-3xl text-ink sm:col-span-2">Organization</h2>
          <label className="text-sm font-medium text-ink">
            Name
            <input value={org} onChange={(event) => setOrg(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base" />
          </label>
          <label className="text-sm font-medium text-ink">
            NPI, optional
            <input value={npi} onChange={(event) => setNpi(event.target.value)} inputMode="numeric" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base" />
          </label>
          <button type="submit" className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink sm:col-span-2">Add organization</button>
          {clients.length > 0 ? (
            <label className="text-sm font-medium text-ink sm:col-span-2">
              Working organization
              <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base">
                {clients.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}{item.npi ? ` · ${item.npi}` : ""}</option>
                ))}
              </select>
            </label>
          ) : null}
        </form>

        <form onSubmit={addClaim} className="mt-6 grid gap-3 rounded-2xl border border-line p-5 sm:grid-cols-2">
          <h2 className="font-display text-3xl text-ink sm:col-span-2">Claim worksheet</h2>
          <label className="text-sm font-medium text-ink sm:col-span-2">
            Payer
            <select value={payer} onChange={(event) => setPayer(event.target.value as "medicare" | "medicaid")} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              <option value="medicare">Federal Medicare, Rest of New York</option>
              <option value="medicaid">New York Medicaid fee-for-service</option>
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Date of service
            <input type="date" value={dos} onChange={(event) => setDos(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
          </label>
          <label className="text-sm font-medium text-ink">
            Place of service
            <select value={pos} onChange={(event) => setPos(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              <option value="11">11 Office</option>
              <option value="12">12 Home</option>
              <option value="41">41 Ambulance, land</option>
              <option value="49">49 Independent clinic</option>
              <option value="99">99 Other</option>
              <option value="">Not set</option>
            </select>
          </label>
          <label className="text-sm font-medium text-ink sm:col-span-2">
            Diagnosis code, optional
            <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value.toUpperCase())} placeholder="M25.561" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
          </label>
          <button type="submit" className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink sm:col-span-2">Open a worksheet</button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            writeSubmitter(submitter);
            setMessage("Submitter saved on this browser. It is not sent anywhere.");
          }}
          className="mt-6 grid gap-3 rounded-2xl border border-line bg-paper-2 p-5 sm:grid-cols-2"
        >
          <h2 className="font-display text-3xl text-ink sm:col-span-2">Submitter</h2>
          <p className="text-sm text-muted sm:col-span-2">The enrolled submitter for MAC 13282. The packet will not be ready without a name, NPI, and submitter ID.</p>
          <label className="text-sm font-medium text-ink">
            Name
            <input value={submitter.name} onChange={(event) => setSubmitter({ ...submitter, name: event.target.value })} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base" />
          </label>
          <label className="text-sm font-medium text-ink">
            NPI
            <input value={submitter.npi} onChange={(event) => setSubmitter({ ...submitter, npi: event.target.value })} inputMode="numeric" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base" />
          </label>
          <label className="text-sm font-medium text-ink sm:col-span-2">
            Submitter ID
            <input value={submitter.submitterId} onChange={(event) => setSubmitter({ ...submitter, submitterId: event.target.value })} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base" />
          </label>
          <button type="submit" className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink sm:col-span-2">Save submitter</button>
        </form>

        <InvoiceIntake
          books={books}
          clientId={clientId}
          onClaims={(next) => {
            setClaims((current) => [...next, ...current]);
            setClaimId(next[0]?.id ?? claimId);
          }}
        />

        {claims.length > 0 ? (
          <label className="mt-4 block text-sm font-medium text-ink">
            Open worksheets
            <select value={claimId ?? ""} onChange={(event) => setClaimId(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base">
              {claims.map((item) => (
                <option key={item.id} value={item.id}>{item.dos} · {(item.payer ?? "medicare") === "medicaid" ? "NY Medicaid" : "Medicare"} · {item.status}</option>
              ))}
            </select>
          </label>
        ) : null}

        {claim ? (
          <section className="mt-6 rounded-2xl border border-line p-5">
            <p className="text-sm text-muted">{client?.name ?? "No organization"} · {claim.dos} · {(claim.payer ?? "medicare") === "medicaid" ? "NY Medicaid" : "Medicare"} · place {claim.pos || "not set"}{claim.diagnosis ? ` · ${claim.diagnosis}` : ""} · {claim.status}</p>
            <form onSubmit={addLine} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-ink">
                Code
                <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
              </label>
              <label className="text-sm font-medium text-ink">
                Modifier
                <input value={modifier} onChange={(event) => setModifier(event.target.value.toUpperCase())} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
              </label>
              <label className="text-sm font-medium text-ink">
                Units
                <input value={units} onChange={(event) => setUnits(event.target.value)} inputMode="numeric" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
              </label>
              <label className="text-sm font-medium text-ink">
                Charge, optional
                <input value={charge} onChange={(event) => setCharge(event.target.value)} inputMode="decimal" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
              </label>
              <button type="submit" disabled={claim.status === "ready"} className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink disabled:opacity-50 lg:col-span-4">Add line</button>
            </form>
            <ul className="mt-4 space-y-3">
              {claim.lines.length === 0 ? (
                <li className="text-sm text-muted">No lines yet.</li>
              ) : (
                claim.lines.map((line) => (
                  <li key={line.id} className="rounded-2xl border border-line px-4 py-3">
                    <p className="font-medium text-ink tabular-nums">{line.code}{line.modifier ? ` ${line.modifier}` : ""} · {line.units} · {line.schedule}</p>
                    <p className="mt-1 text-sm text-muted">{line.note}</p>
                    <p className="mt-1 text-sm text-ink">Charge {moneyOrBlank(line.chargeCents, line.units) || "not entered"}. Allowed {moneyOrBlank(line.allowedCents, line.units) || "none on the selected file"}.</p>
                    <p className="mt-1 text-sm text-muted">Other payer, {line.otherSchedule ?? "not compared"}: {line.otherCents == null ? "no amount" : money((line.otherCents * line.units) / 100)}.</p>
                  </li>
                ))
              )}
            </ul>
            {totals ? (
              <p className="mt-4 text-sm text-ink">
                Worksheet charge {totals.chargeCents === null ? "not entered" : money(totals.chargeCents / 100)}. Selected allowed {totals.allowedCents === null ? "none" : money(totals.allowedCents / 100)}.
                {cut && (claim.payer ?? "medicare") === "medicare" ? ` If the deductible were met, Medicare pays ${money(cut.paid)} after ${percent}% sequestration. Not a payment.` : ""}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {claim.status === "draft" ? (
                <button type="button" onClick={() => setStatus("ready")} className="h-12 rounded-full bg-ink px-5 text-sm font-medium text-paper">Mark ready</button>
              ) : (
                <button type="button" onClick={() => setStatus("draft")} className="h-12 rounded-full border border-line px-5 text-sm font-medium text-ink">Return to draft</button>
              )}
              <button type="button" onClick={download} className="h-12 rounded-full border border-line px-5 text-sm font-medium text-ink">Download CSV</button>
              <button type="button" onClick={downloadPacket} className="h-12 rounded-full border border-line px-5 text-sm font-medium text-ink">Download 837P packet</button>
            </div>
            {(() => {
              const packet = buildPacket(claim, client, submitter);
              const alerts = claimAlerts(claim, books);
              return (
                <section className="mt-6 rounded-2xl border border-line bg-paper p-4">
                  <p className="text-xs font-medium tracking-widest text-teal uppercase">{packet.ready ? "Ready to hand off" : "Not complete"}</p>
                  <h2 className="mt-2 font-display text-2xl text-ink">{packet.form} · {packet.receiver}</h2>
                  <p className="mt-2 text-sm text-muted">{packet.locality}. {packet.next}</p>
                  {alerts.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {alerts.map((item) => (
                        <li key={item.line.id} className="rounded-xl border border-deep px-3 py-2 text-sm">
                          <p className="font-medium text-deep">High alert · {item.line.code}</p>
                          <p className="mt-1 text-ink">{item.check.reason} Expected {item.check.expectedCode} at {item.check.expectedCents === null ? "no loaded amount" : money(item.check.expectedCents / 100)}.</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-ink">No high alerts on this claim.</p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs tracking-widest text-muted uppercase">Box 1</dt><dd className="mt-1 text-ink">{packet.cms1500.box1}</dd></div>
                    <div><dt className="text-xs tracking-widest text-muted uppercase">Box 21</dt><dd className="mt-1 text-ink tabular-nums">{packet.cms1500.box21 || "blank"}</dd></div>
                    <div><dt className="text-xs tracking-widest text-muted uppercase">Box 32</dt><dd className="mt-1 text-ink">{packet.cms1500.box32}</dd></div>
                    <div><dt className="text-xs tracking-widest text-muted uppercase">Box 33a</dt><dd className="mt-1 text-ink tabular-nums">{packet.cms1500.box33a || "blank"}</dd></div>
                  </dl>
                  {packet.missing.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-ink">
                      {packet.missing.map((item) => (
                        <li key={item}>Missing. {item}.</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })()}
          </section>
        ) : null}
        {message ? <p className="mt-4 text-sm font-medium text-deep" role="alert">{message}</p> : null}
      </main>
    </Shell>
  );
}

function moneyOrBlank(cents: number | null, units: number) {
  if (cents === null) return "";
  return money((cents * units) / 100);
}

function csv(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

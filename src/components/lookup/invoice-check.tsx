import { useEffect, useState, type FormEvent } from "react";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, auditReport, gradeLookup, type CheckLine } from "@/lib/lookup/check";
import { rememberPayments, readPaymentMemory, type StoredAlert } from "@/lib/lookup/memory";
import { pricedYears, reasonLine } from "@/lib/lookup/reason";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { auditPrice, type AmbulanceRow, type DmeRow, type LabRow, type Priced } from "@/lib/lookup/schedule-price";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { prepareInvoice, readImportFile } from "@/lib/lookup/import-text";
import { unknownBeside } from "@/lib/lookup/reason";
import { rankInvoice } from "@/lib/team/rank";
import { Link } from "@tanstack/react-router";
import { CodeTypeList, TypeRollup } from "@/components/lookup/code-types";
import { typeRollup } from "@/lib/lookup/code-types";
import { exportCheckCsv } from "@/lib/lookup/export-check";
import { FeeTeamReport } from "@/components/lookup/fee-teams";
import { detectPosted, rememberFound, type FoundCode } from "@/lib/lookup/detect";
import { answerFor, rememberLookups, type Lookup } from "@/lib/lookup/persist";
import type { SavedRow } from "@/lib/lookup/saved-codes";

type Hit = { family: Family; label: string; row: Row };
type Checked = CheckLine & { hits: Hit[]; once: OnceRow | null; rest: OnceRow[]; priced: Priced };

const files = new Map<string, Promise<{ rows: DmeRow[] } | { rows: LabRow[] } | { rows: AmbulanceRow[] } | null>>();
let savedRows: Promise<SavedRow[]> | null = null;
let lookupRows: Promise<Lookup[]> | null = null;

function loadLookups() {
  lookupRows ??= fetch("/lookups.json").then(async (response) => {
    if (!response.ok) return [];
    const body = await response.json() as { rows?: Lookup[] };
    return body.rows ?? [];
  }).catch(() => []);
  return lookupRows;
}

function loadSaved() {
  savedRows ??= fetch("/saved-codes.json").then(async (response) => {
    if (!response.ok) return [];
    const body = await response.json() as { groups?: { rows: SavedRow[] }[] };
    return (body.groups ?? []).flatMap((group) => group.rows);
  }).catch(() => []);
  return savedRows;
}

function loadFee(path: string) {
  const hit = files.get(path);
  if (hit) return hit;
  const pending = fetch(path).then(async (response) => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("missing");
    return response.json() as Promise<{ rows: DmeRow[] } | { rows: LabRow[] } | { rows: AmbulanceRow[] }>;
  });
  files.set(path, pending);
  return pending;
}

export function InvoiceCheck() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Checked[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [memory, setMemory] = useState<StoredAlert[]>([]);

  useEffect(() => {
    setMemory(readPaymentMemory());
  }, []);

  async function runText(raw: string) {
    const gate = rankInvoice({ look: 0, off: 0, match: 0 }, raw);
    if (gate.status === "stop") {
      setText("");
      setFileName(null);
      setRows(null);
      setNote(gate.detail);
      setDown(false);
      setBusy(false);
      return;
    }
    const short = [...raw.matchAll(/^SHORT (\S+)$/gm)].map((item) => item[1]);
    const body = raw.replace(/^SHORT .+$/gm, "").trim();
    const safe = prepareInvoice(body);
    const parsed = readInvoiceLines(body);
    setText(safe);
    setBusy(true);
    setDown(false);
    setNote(short.length > 0 ? `${short.length === 1 ? "1 line had a short code" : `${short.length} lines had a short code`} (${short.join(", ")}). A full code was not guessed.` : null);
    setPlaced(null);
    try {
      const checked: Checked[] = [];
      const found: FoundCode[] = [];
      const years = [...new Set(parsed.map((line) => line.year).filter((year): year is number => year !== null))];
      const [saved, lookups] = await Promise.all([loadSaved(), loadLookups()]);
      const feeByYear = new Map<number, { dme: { rows: DmeRow[] } | null; lab: { rows: LabRow[] } | null; ambulance: { rows: AmbulanceRow[] } | null }>();
      await Promise.all(years.map(async (year) => {
        const [dme, lab, ambulance] = await Promise.all([
          loadFee(`/dme-${year}.json`),
          loadFee(`/clfs-${year}.json`),
          loadFee(`/afs-${year}.json`),
        ]);
        feeByYear.set(year, { dme: dme as { rows: DmeRow[] } | null, lab: lab as { rows: LabRow[] } | null, ambulance: ambulance as { rows: AmbulanceRow[] } | null });
      }));
      await Promise.all([...new Set(parsed.map((line) => line.code))].map((code) => Promise.all([findAcross(code), loadOnce(code[0])])));
      for (const line of parsed) {
        const hits = await findAcross(line.code);
        const shard = await loadOnce(line.code[0]);
        const list = shard[line.code] ?? [];
        const once = pickOnce(list, line.year, line.month);
        const fee = line.year ? feeByYear.get(line.year) : undefined;
        const prior = answerFor(lookups, line.code, line.year, line.month);
        let priced = auditPrice({
          line,
          hits,
          onceList: list,
          saved,
          dme: line.schedule === "dme" ? fee?.dme ?? null : null,
          lab: line.schedule === "lab" ? fee?.lab ?? null : null,
          ambulance: line.schedule === "ambulance" || line.schedule === "miles" ? fee?.ambulance ?? null : null,
        });
        const settled = priced.cents === null && prior;
        if (!settled && (priced.cents === null || line.schedule === "none" || line.schedule === "dme" || line.schedule === "ambulance")) {
          const detected = detectPosted({
            code: line.code,
            modifier: line.modifier,
            year: line.year,
            month: line.month,
            schedule: line.schedule,
            dme: fee?.dme?.rows ?? null,
            lab: fee?.lab?.rows ?? null,
            ambulance: fee?.ambulance?.rows ?? null,
            saved,
          });
          const related = detected.related.length > 0 ? `Related codes on that file: ${detected.related.join(", ")}.` : null;
          if ((line.schedule === "none" || line.schedule === "other") && detected.use && priced.cents === null) {
            priced = { cents: detected.use.cents, label: detected.use.label, block: null, note: related, otherCents: detected.use.otherCents };
          } else if (priced.block && detected.elsewhere) {
            priced = { ...priced, block: `${priced.block} ${detected.elsewhere}` };
          } else if (related && priced.cents !== null) {
            priced = { ...priced, note: [priced.note, related].filter(Boolean).join(" ") };
          }
          if (priced.cents === null || line.schedule === "none" || detected.elsewhere) {
            found.push({ code: line.code, year: line.year, source: detected.use?.label ?? detected.elsewhere ?? "Unknown", cents: detected.use?.cents ?? null, related: detected.related, at: new Date().toISOString() });
          }
        }
        if (priced.cents === null) {
          const answer = prior;
          if (answer?.payable && (line.schedule === "none" || line.schedule === "other")) {
            priced = { cents: answer.payable, label: answer.asOf, block: null, note: answer.note ?? null, otherCents: null };
          } else if (!answer) {
            const priors = [
              ...hits.flatMap((hit) => Object.entries(hit.row.a).flatMap(([year, cents]) => (typeof cents === "number" ? [{ year: Number(year), cents }] : []))),
              ...saved.flatMap((row) => (row.c === line.code && row.year && row.cents ? [{ year: row.year, cents: row.cents }] : [])),
            ];
            const text = `Unknown. Looked through the posted files. No amount was saved. ${unknownBeside(line.year, priors)}`;
            priced = { ...priced, block: priced.block ? `${priced.block} ${text}` : text };
            rememberLookups([{
              c: line.code,
              status: "unknown",
              cents: null,
              at: new Date().toISOString(),
              year: line.year,
              months: line.month ? [line.month] : null,
              asOf: "No posted dollar.",
              related: [],
            }]);
          } else {
            const priors = [
              ...hits.flatMap((hit) => Object.entries(hit.row.a).flatMap(([year, cents]) => (typeof cents === "number" ? [{ year: Number(year), cents }] : []))),
              ...saved.flatMap((row) => (row.c === line.code && row.year && row.cents ? [{ year: row.year, cents: row.cents }] : [])),
            ];
            const relatedCodes = answer.related.length ? ` Related: ${answer.related.join(", ")}.` : "";
            const beside = answer.status === "unknown" ? ` ${unknownBeside(line.year, priors)}` : "";
            const text = answer.status === "known"
              ? `${answer.asOf} ${answer.note ?? ""}`.trim()
              : `Unknown. ${answer.asOf}${relatedCodes}${beside}`;
            priced = { ...priced, block: priced.block ? `${priced.block} ${text}` : text };
          }
        }
        checked.push({ ...line, hits, once, rest: list.filter((row) => row !== once), priced });
      }
      rememberFound(found);
      setRows(checked);
      const alerts = checked.flatMap((line) => {
        const report = reviewed(line);
        if (report.kind === "match") return [];
        return [{
          id: `${line.code}-${line.year ?? "none"}-${line.paidCents ?? line.billedCents ?? "none"}`,
          at: new Date().toISOString(),
          code: line.code,
          year: line.year,
          billedCents: line.billedCents,
          fileCents: decision(line).cents,
          kind: report.kind,
          reason: report.reasons[0] ?? "",
        }];
      });
      rememberPayments(alerts);
      setMemory(alerts);
    } catch {
      setRows(null);
      setDown(true);
    } finally {
      setBusy(false);
    }
  }

  function saveCopy() {
    if (!rows || rows.length === 0) return;
    const body = exportCheckCsv(rows.map((line) => ({
      code: line.code,
      modifier: line.modifier,
      date: line.date,
      year: line.year,
      units: line.units,
      schedule: line.schedule,
      lookupCents: line.lookupCents,
      adminCents: line.adminCents,
      seqRate: line.seqRate,
      seqPayCents: line.seqPayCents,
      fileCents: line.priced.cents,
      otherCents: line.priced.otherCents,
      fileLabel: line.priced.label,
      block: line.priced.block,
      note: line.priced.note,
    })));
    const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName ? fileName.replace(/\.[^.]+$/, "") + "-check.csv" : "lane-check.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function run(event?: FormEvent) {
    event?.preventDefault();
    void runText(text);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    readImportFile(file)
      .then((read) => {
        if ("error" in read) {
          setNote(read.error);
          setRows(null);
          setFileName(null);
          return;
        }
        setFileName(file.name);
        void runText(read.text);
      })
      .catch(() => setDown(true));
  }

  function place() {
    if (!rows) return;
    let added = 0;
    let skipped = 0;
    for (const line of rows) {
      if (!line.year || !line.units) {
        skipped += 1;
        continue;
      }
      const file = line.priced;
      const name = line.hits[0]?.row.n || line.once?.n || line.code;
      addToOpenClaim({
        code: line.code,
        modifier: line.modifier,
        units: line.units,
        chargeCents: line.billedCents,
        allowedCents: file.block ? null : file.cents,
        schedule: file.block ? "Not used" : file.label ? `${file.label}, ${line.year}` : "Not on a loaded file",
        note: name,
        year: line.year,
        dos: line.date,
      });
      added += 1;
    }
    setPlaced(skipped > 0 ? `${added} lines are on the claim. ${skipped} had no year or no units and stayed here.` : `${added} lines are on the claim.`);
  }

  const groups = new Map<string, Checked[]>();
  for (const row of rows ?? []) {
    const priced = row.priced;
    const label = priced.block ? "Needs a person" : priced.label ?? "Not on a file";
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }
  const labels = [...groups.keys()].sort((a, b) => Number(a === "Not on a file") - Number(b === "Not on a file"));
  const sorted = {
    match: (rows ?? []).filter((line) => bucket(line) === "match"),
    off: (rows ?? []).filter((line) => bucket(line) === "off"),
    look: (rows ?? []).filter((line) => bucket(line) === "look"),
  };
  const brief = rows
    ? rankInvoice({ look: sorted.look.length, off: sorted.off.length, match: sorted.match.length })
    : null;
  const audit = (rows ?? []).some((line) => line.schedule);
  const adminUnder = (rows ?? []).filter((line) => reviewed(line).adminUnder);
  const noDollar = (rows ?? []).filter((line) => line.schedule && reviewed(line).bare && line.priced.cents === null);
  const lead = audit && rows
    ? typeRollup(rows.map((line) => ({
        schedule: line.schedule,
        fileCents: line.priced.cents,
        units: line.units,
        seqRate: line.seqRate,
        adminCents: line.adminCents,
        otherCents: line.priced.otherCents,
      })))
    : null;
  const cards = audit
    ? {
        match: { title: "Lookup matches", detail: "Their fee matches the file for that schedule.", tone: "ok" as const },
        off: { title: "Lookup is off", detail: "Their fee is not the file amount.", tone: "bad" as const },
        look: { title: "No dollar loaded", detail: "The schedule was blank, or that file has no amount.", tone: "plain" as const },
      }
    : {
        match: { title: "Matches", detail: "The charge matches the file.", tone: "ok" as const },
        off: { title: "Does not match", detail: "Over or under the file. Do not pay that amount.", tone: "bad" as const },
        look: { title: "Needs a person", detail: "No year, no charge, or not on a file.", tone: "plain" as const },
      };

  return (
    <form onSubmit={run}>
      <CodeTypeList />
      <label className="mt-6 block text-sm font-medium text-ink">
        Import a report
        <input
          type="file"
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="mt-1.5 block w-full text-sm text-ink file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-teal file:px-4 file:text-sm file:font-medium file:text-teal-ink"
        />
      </label>
      {fileName ? <p className="mt-2 text-sm text-muted">{fileName}</p> : null}
      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="invoice-lines">
        Or type the lines
        <textarea
          id="invoice-lines"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder={"97110  3/1/2026  1 unit  paid 30.00"}
          className="mt-1.5 w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-base text-ink"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="h-12 rounded-full border border-line px-5 text-sm font-medium text-ink" disabled={busy}>
          {busy ? "Checking" : "Check it"}
        </button>
        {rows && rows.length > 0 ? (
          <button type="button" onClick={saveCopy} className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
            Save a copy
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">Bring the sheet. The correct fee is the file for that code type. Then compare what the other party wants to pay. Equipment in Olean uses the rural file. After 0.98, that is the amount you pay. A non-rural number is the wrong schedule. Nothing is sent.</p>
      {memory.length > 0 && !rows ? (
        <section className="mt-4 rounded-2xl border border-alert bg-alert-wash px-4 py-3" role="alert">
          <p className="text-sm font-medium text-ink"><span className="font-medium">Rank.</span> {rankInvoice({ look: memory.filter((item) => item.kind === "look").length, off: memory.filter((item) => item.kind === "off").length, match: 0 }).detail}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {[...memory].sort((a, b) => Number(a.kind === "off") - Number(b.kind === "off")).map((item) => (
              <li key={item.id} className={item.kind === "off" ? "rounded-xl border border-alert bg-alert-wash px-3 py-2 text-ink" : "rounded-xl border border-wait bg-wait-wash px-3 py-2 text-ink"}>{item.reason}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {note ? <p className="mt-4 text-sm font-medium text-deep">{note}</p> : null}
      {down ? <p className="mt-4 text-sm font-medium text-deep">The year files did not load. The invoice is still here. Check it again.</p> : null}
      {rows && rows.length === 0 ? <p className="mt-4 text-sm font-medium text-deep">No code was on those lines.</p> : null}
      {lead ? (
        <>
          <p className="mt-6 font-display text-3xl leading-tight text-ink">
            You pay {money(lead.totals.payable / 100)}. They want to pay {money(lead.totals.theirs / 100)}. {money(lead.totals.wrongGap / 100)} is on the wrong schedule.
          </p>
          {lead.groups.filter((type) => type.wrongLines > 0).map((type) => (
            <p key={type.id} className="mt-1 text-sm text-ink">{type.name}. {money(type.wrongGap / 100)} on the wrong schedule.</p>
          ))}
        </>
      ) : null}
      {audit && rows ? (
        <FeeTeamReport
          lines={rows.map((line) => {
            const report = reviewed(line);
            return {
              pricedCents: line.priced.cents,
              block: line.priced.block,
              adminCents: line.adminCents,
              wrongSchedule: report.reasons[0]?.startsWith("Wrong fee schedule") === true,
              gapCents: report.reasons[0]?.startsWith("Wrong fee schedule") ? report.gapCents : null,
            };
          })}
        />
      ) : null}
      {audit && rows ? (
        <TypeRollup
          lines={rows.map((line) => ({
            schedule: line.schedule,
            fileCents: line.priced.cents,
            units: line.units,
            seqRate: line.seqRate,
            adminCents: line.adminCents,
            otherCents: line.priced.otherCents,
          }))}
        />
      ) : null}
      {rows && rows.length > 0 ? (
        <div className={audit ? "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "mt-4 grid gap-3 sm:grid-cols-3"}>
          {(audit ? (["match", "off", "look"] as const) : (brief?.order ?? [])).map((key) => (
            <Summary key={key} title={cards[key].title} detail={cards[key].detail} lines={key === "look" && audit ? noDollar : sorted[key]} tone={cards[key].tone} />
          ))}
          {audit ? <Summary title="Administrator paid under" detail="Below the file, and 0.98 does not explain it." lines={adminUnder} tone="bad" /> : null}
        </div>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={place} className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
            Save these lines
          </button>
          {placed ? (
            <p className="text-sm text-ink" role="status">
              {placed}{" "}
              <Link to="/billing" className="font-medium text-teal">
                See saved lines.
              </Link>{" "}
              Nothing is sent.
            </p>
          ) : null}
        </div>
      ) : null}
      {labels.map((label) => {
        const lines = groups.get(label) ?? [];
        const off = lines.filter((line) => bucket(line) === "off").length;
        const look = lines.filter((line) => bucket(line) === "look").length;
        const note = off > 0 ? `${off} off` : look > 0 ? `${look} need a person` : "matches";
        return (
          <section key={label} className="mt-6">
            <h3 className="font-display text-2xl text-ink">
              {label}
              <span className="ml-2 text-base text-muted">{lines.length} {lines.length === 1 ? "line" : "lines"} · {note}</span>
            </h3>
            <ul className="mt-3 space-y-3">
              {lines.map((line, index) => {
                const key = `${line.code}-${index}`;
                const chosen = best(line);
                const reason = facts(line);
                const tone = bucket(line);
                return (
                  <li key={key} className={tone === "off" ? "rounded-2xl border border-alert bg-alert-wash px-4 py-3" : tone === "look" ? "rounded-2xl border border-wait bg-wait-wash px-4 py-3" : "rounded-2xl border border-teal bg-wash px-4 py-3"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink tabular-nums">{line.code}{line.modifier ? `-${line.modifier}` : ""}</p>
                        <p className="text-sm text-muted">{line.date || "No date"} · {amounts(line)}</p>
                      </div>
                      <p className={tone === "match" ? "text-right text-sm font-medium text-teal" : tone === "off" ? "text-right text-sm font-medium text-alert" : "text-right text-sm font-medium text-wait"}>{labelFor(line)}</p>
                    </div>
                    {tone !== "match" ? <p className="mt-2 text-sm font-medium text-ink" role="alert">{reviewed(line).reasons[0]}</p> : null}
                    {line.rest.length > 0 ? <p className="mt-2 text-xs text-muted">Also on {line.rest.map((row) => `${row.s} ${money(row.c / 100)}`).join("; ")}.</p> : null}
                    <ol className="mt-2 space-y-1 text-sm text-muted">
                      {(tone === "match" ? reason.steps : reason.steps.slice(1)).map((step) => <li key={step}>{step}</li>)}
                    </ol>
                    {chosen ? (
                      <button type="button" onClick={() => setOpen(open === key ? null : key)} className="mt-2 text-sm text-teal">
                        {open === key ? "Hide the years" : "Show every year"}
                      </button>
                    ) : null}
                    {open === key && chosen ? <YearPrices row={chosen.row} mark={line.year} /> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </form>
  );
}

function bucket(line: Checked) {
  return reviewed(line).kind;
}

function reviewed(line: Checked) {
  if (line.schedule) {
    return gradeLookup({
      code: line.code,
      year: line.year,
      units: line.units,
      lookupCents: line.lookupCents,
      fileCents: line.priced.cents,
      adminCents: line.adminCents,
      seqRate: line.seqRate,
      seqPayCents: line.seqPayCents,
      block: line.priced.block,
      note: line.priced.note,
      otherCents: line.priced.otherCents,
    });
  }
  const report = auditReport({
    code: line.code,
    year: line.year,
    billedCents: line.billedCents,
    paidCents: line.paidCents,
    paidKind: line.paidKind,
    fileCents: line.priced.cents,
    units: line.units,
    block: line.priced.block,
  });
  return { ...report, adminUnder: false, bare: false };
}

function decision(line: Checked) {
  return line.priced;
}

function Summary({ title, detail, lines, tone }: { title: string; detail: string; lines: Checked[]; tone: "ok" | "bad" | "plain" }) {
  const billed = lines.reduce((sum, line) => sum + (line.billedCents ?? 0), 0);
  const paid = lines.reduce((sum, line) => sum + (line.paidCents ?? 0), 0);
  const paidLines = lines.filter((line) => line.paidCents !== null).length;
  let over = 0;
  let under = 0;
  for (const line of lines) {
    const gap = reviewed(line).gapCents;
    if (gap === null || gap === 0) continue;
    if (gap > 0) over += gap;
    else under += -gap;
  }
  return (
    <div className={tone === "bad" ? "rounded-2xl border border-alert bg-alert-wash px-4 py-3" : tone === "plain" ? "rounded-2xl border border-wait bg-wait-wash px-4 py-3" : "rounded-2xl border border-teal bg-wash px-4 py-3"}>
      <p className={tone === "ok" ? "text-sm font-medium text-teal" : tone === "bad" ? "text-sm font-medium text-alert" : "text-sm font-medium text-wait"}>{title}</p>
      <p className="mt-1 font-display text-2xl text-ink tabular-nums">{lines.length}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      {lines.length === 0 ? <p className="mt-1 text-sm tabular-nums text-ink">None</p> : null}
      {paidLines > 0 ? <p className="mt-1 text-sm tabular-nums text-ink">Paid {money(paid / 100)}</p> : null}
      {billed > 0 ? <p className="mt-1 text-sm tabular-nums text-ink">Billed {money(billed / 100)}</p> : null}
      {over > 0 ? <p className="mt-1 text-sm tabular-nums text-alert">Over {money(over / 100)}</p> : null}
      {under > 0 ? <p className="mt-1 text-sm tabular-nums text-alert">Under {money(under / 100)}</p> : null}
    </div>
  );
}

function best(line: Checked) {
  const year = line.year ? String(line.year) : "";
  const forYear = line.hits.find((hit) => typeof hit.row.a[year] === "number");
  if (forYear) return forYear;
  return line.hits.find((hit) => Object.values(hit.row.a).some((value) => typeof value === "number")) ?? line.hits[0];
}

function facts(line: Checked) {
  const report = reviewed(line);
  if (line.paidCents !== null || report.kind !== "match") return { verdict: report.kind === "match" ? "match" as const : "off" as const, steps: report.reasons };
  const priced = decision(line);
  const chosen = best(line);
  const onThisYear = Boolean(line.year && chosen && typeof chosen.row.a[String(line.year)] === "number");
  return reasonLine({
    code: line.code,
    year: line.year,
    billedCents: line.billedCents,
    file: priced.cents === null ? null : { cents: priced.cents * (line.units ?? 1), label: priced.label ?? "File", period: line.once && priced.label === line.once.s ? line.once.t : undefined },
    priors: onThisYear && chosen ? pricedYears(chosen.row.a) : [],
  });
}

function labelFor(line: Checked) {
  const report = reviewed(line);
  if (line.schedule) {
    if (report.reasons[0]?.startsWith("Wrong fee schedule")) return "Wrong fee schedule";
    if (report.side === "over" || report.side === "under") return `${report.side === "over" ? "Lookup over" : "Lookup under"} ${money(Math.abs(report.gapCents ?? 0) / 100)}`;
    if (report.kind === "look") return "Needs a person";
    return "Lookup matches";
  }
  if (report.side === "over") return `${line.paidKind === "allowed" ? "Allowed over" : line.paidCents !== null ? "Overpaid" : "Over"} ${money((report.gapCents ?? 0) / 100)}`;
  if (report.side === "under") return `${line.paidKind === "allowed" ? "Allowed under" : line.paidCents !== null ? "Underpaid" : "Under"} ${money(Math.abs(report.gapCents ?? 0) / 100)}`;
  if (report.kind === "look") return line.paidCents !== null && !line.year ? "No year on the line" : "Needs a person";
  if (line.paidCents !== null) return "Paid the file";
  return line.year ? `Matches ${line.year}` : "Matches";
}

function amounts(line: Checked) {
  const parts = [line.schedule ? line.schedule.toUpperCase() : null];
  if (line.lookupCents) parts.push(`lookup ${money(line.lookupCents / 100)}`);
  if (line.priced.cents !== null && line.seqRate && line.units) parts.push(`pay ${money(Math.round(line.priced.cents * line.units * line.seqRate) / 100)}`);
  else if (line.priced.cents !== null) parts.push(`file ${money(line.priced.cents / 100)}`);
  if (line.adminCents) parts.push(`their amount ${money(line.adminCents / 100)}`);
  if (line.billedCents !== null) parts.push(`billed ${money(line.billedCents / 100)}`);
  const shown = parts.filter(Boolean).join(" · ");
  if (shown) return shown;
  const paid = line.paidCents === null ? null : `${line.paidKind === "allowed" ? "allowed" : "paid"} ${money(line.paidCents / 100)}`;
  return paid ?? "no amount";
}

import { useEffect, useState, type FormEvent } from "react";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, auditReport, type CheckLine } from "@/lib/lookup/check";
import { rememberPayments, readPaymentMemory, type StoredAlert } from "@/lib/lookup/memory";
import { pricedYears, reasonLine } from "@/lib/lookup/reason";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { associate } from "@/lib/lookup/associate";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { rankInvoice } from "@/lib/team/rank";
import { Link } from "@tanstack/react-router";

type Hit = { family: Family; label: string; row: Row };
type Checked = CheckLine & { hits: Hit[]; once: OnceRow | null; rest: OnceRow[] };

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
      setRows(null);
      setNote(gate.detail);
      setDown(false);
      setBusy(false);
      return;
    }
    const parsed = readInvoiceLines(raw);
    setBusy(true);
    setDown(false);
    setNote(null);
    setPlaced(null);
    try {
      const checked: Checked[] = [];
      for (const line of parsed) {
        const hits = await findAcross(line.code);
        const shard = await loadOnce(line.code[0]);
        const list = shard[line.code] ?? [];
        const once = pickOnce(list, line.year, line.month);
        checked.push({ ...line, hits, once, rest: list.filter((row) => row !== once) });
      }
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

  function run(event?: FormEvent) {
    event?.preventDefault();
    void runText(text);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setNote("That file is over 1 MB. Export a smaller invoice.");
      setRows(null);
      return;
    }
    file.text().then((raw) => {
      setText(raw);
      setFileName(file.name);
      void runText(raw);
    }).catch(() => setDown(true));
  }

  function place() {
    if (!rows) return;
    let added = 0;
    let skipped = 0;
    for (const line of rows) {
      if (!line.year || line.units === null) {
        skipped += 1;
        continue;
      }
      const file = decision(line);
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
    const priced = decision(row);
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
  const cards = {
    match: { title: "Matches", detail: "The charge matches the file.", tone: "ok" as const },
    off: { title: "Does not match", detail: "Over or under the file. Do not pay that amount.", tone: "bad" as const },
    look: { title: "Needs a person", detail: "No year, no charge, or not on a file.", tone: "plain" as const },
  };

  return (
    <form onSubmit={run}>
      <label className="inline-flex h-12 cursor-pointer items-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
        Import a report
        <input
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="sr-only"
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
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
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">An invoice is checked on the charge. An administrator report is checked on Paid or Allowed. A paid amount is never used as the charge. The check uses the full file amount for that code and year. Nothing is sent.</p>
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
      {brief && rows && rows.length > 0 ? <p className="mt-4 text-sm text-ink"><span className="font-medium">Rank.</span> {brief.detail}</p> : null}
      {rows && rows.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(brief?.order ?? []).map((key) => (
            <Summary key={key} title={cards[key].title} detail={cards[key].detail} lines={sorted[key]} tone={cards[key].tone} />
          ))}
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
  const priced = decision(line);
  return auditReport({
    code: line.code,
    year: line.year,
    billedCents: line.billedCents,
    paidCents: line.paidCents,
    paidKind: line.paidKind,
    fileCents: priced.cents,
    units: line.units,
    block: priced.block,
  });
}

function decision(line: Checked) {
  return associate({
    code: line.code,
    modifier: line.modifier,
    year: line.year,
    setting: line.setting,
    payer: line.payer,
    ambiguous: line.ambiguous,
    chargeKnown: line.chargeKnown,
    paymentAudit: line.paidCents !== null,
    hits: line.hits,
    once: line.once,
  });
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
  if (report.side === "over") return `${line.paidKind === "allowed" ? "Allowed over" : line.paidCents !== null ? "Overpaid" : "Over"} ${money((report.gapCents ?? 0) / 100)}`;
  if (report.side === "under") return `${line.paidKind === "allowed" ? "Allowed under" : line.paidCents !== null ? "Underpaid" : "Under"} ${money(Math.abs(report.gapCents ?? 0) / 100)}`;
  if (report.kind === "look") return line.paidCents !== null && !line.year ? "No year on the line" : "Needs a person";
  if (line.paidCents !== null) return "Paid the file";
  return line.year ? `Matches ${line.year}` : "Matches";
}

function amounts(line: Checked) {
  const paid = line.paidCents === null ? null : `${line.paidKind === "allowed" ? "allowed" : "paid"} ${money(line.paidCents / 100)}`;
  const billed = line.billedCents === null ? null : `billed ${money(line.billedCents / 100)}`;
  if (paid && billed) return `${paid} · ${billed}`;
  return paid ?? billed ?? "no amount";
}

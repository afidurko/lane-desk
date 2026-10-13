import { useEffect, useState, type FormEvent } from "react";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, payBucket, paymentAlert, type CheckLine } from "@/lib/lookup/check";
import { rememberPayments, readPaymentMemory, type StoredAlert } from "@/lib/lookup/memory";
import { pricedYears, reasonLine } from "@/lib/lookup/reason";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
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
        const once = pickOnce(list, line.year);
        checked.push({ ...line, hits, once, rest: list.filter((row) => row !== once) });
      }
      setRows(checked);
      const alerts = checked.flatMap((line) => {
        const alert = paymentAlert({
          code: line.code,
          year: line.year,
          billedCents: line.billedCents,
          fileCents: amountOf(line)?.cents ?? null,
        });
        if (alert.kind === "match") return [];
        return [{
          id: `${line.code}-${line.year ?? "none"}-${line.billedCents ?? "none"}`,
          at: new Date().toISOString(),
          code: line.code,
          year: line.year,
          billedCents: line.billedCents,
          fileCents: amountOf(line)?.cents ?? null,
          kind: alert.kind,
          reason: alert.reason,
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
      if (!line.year) {
        skipped += 1;
        continue;
      }
      const file = amountOf(line);
      const name = line.hits[0]?.row.n || line.once?.n || line.code;
      addToOpenClaim({
        code: line.code,
        modifier: line.modifier,
        units: 1,
        chargeCents: line.billedCents,
        allowedCents: file?.cents ?? null,
        schedule: file ? `${file.label}, ${line.year}` : "Not on a loaded file",
        note: name,
        year: line.year,
        dos: line.date,
      });
      added += 1;
    }
    setPlaced(skipped > 0 ? `${added} lines are on the claim. ${skipped} had no year and stayed here.` : `${added} lines are on the claim.`);
  }

  const groups = new Map<string, Checked[]>();
  for (const row of rows ?? []) {
    const label = amountOf(row)?.label ?? "Not on a file";
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
    off: { title: "Does not match", detail: "Do not pay the billed amount.", tone: "bad" as const },
    look: { title: "Needs a person", detail: "No year, no charge, or not on a file.", tone: "plain" as const },
  };

  return (
    <form onSubmit={run}>
      <label className="inline-flex h-12 cursor-pointer items-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
        Import an invoice
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
          placeholder={"97110  3/1/2026  $30.00"}
          className="mt-1.5 w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-base text-ink"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="h-12 rounded-full border border-line px-5 text-sm font-medium text-ink" disabled={busy}>
          {busy ? "Checking" : "Check it"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">A file is checked as soon as you import it. Rank puts a problem line ahead of a match. Nothing is sent.</p>
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
        const off = lines.filter((line) => verdict(line) !== "match").length;
        return (
          <section key={label} className="mt-6">
            <h3 className="font-display text-2xl text-ink">
              {label}
              <span className="ml-2 text-base text-muted">{lines.length} {lines.length === 1 ? "line" : "lines"}{off > 0 ? ` · ${off} off` : " · matches"}</span>
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
                        <p className="text-sm text-muted">{line.date || "No date"} · billed {line.billedCents === null ? "nothing" : money(line.billedCents / 100)}</p>
                      </div>
                      <p className={tone === "match" ? "text-right text-sm font-medium text-teal" : tone === "off" ? "text-right text-sm font-medium text-alert" : "text-right text-sm font-medium text-wait"}>{labelFor(line)}</p>
                    </div>
                    {tone !== "match" ? <p className="mt-2 text-sm font-medium text-ink" role="alert">{paymentAlert({ code: line.code, year: line.year, billedCents: line.billedCents, fileCents: amountOf(line)?.cents ?? null }).reason}</p> : null}
                    {line.rest.length > 0 ? <p className="mt-2 text-xs text-muted">Also on {line.rest.map((row) => `${row.s} ${money(row.c / 100)}`).join("; ")}.</p> : null}
                    <ol className="mt-2 space-y-1 text-sm text-muted">
                      {reason.steps.map((step) => <li key={step}>{step}</li>)}
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
  return payBucket(line, amountOf(line)?.cents ?? null);
}

function Summary({ title, detail, lines, tone }: { title: string; detail: string; lines: Checked[]; tone: "ok" | "bad" | "plain" }) {
  const billed = lines.reduce((sum, line) => sum + (line.billedCents ?? 0), 0);
  return (
    <div className={tone === "bad" ? "rounded-2xl border border-alert bg-alert-wash px-4 py-3" : tone === "plain" ? "rounded-2xl border border-wait bg-wait-wash px-4 py-3" : "rounded-2xl border border-teal bg-wash px-4 py-3"}>
      <p className={tone === "ok" ? "text-sm font-medium text-teal" : tone === "bad" ? "text-sm font-medium text-alert" : "text-sm font-medium text-wait"}>{title}</p>
      <p className="mt-1 font-display text-2xl text-ink tabular-nums">{lines.length}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      <p className="mt-1 text-sm tabular-nums text-ink">{lines.length === 0 ? "None" : `Billed ${money(billed / 100)}`}</p>
    </div>
  );
}

function best(line: Checked) {
  const year = line.year ? String(line.year) : "";
  const forYear = line.hits.find((hit) => typeof hit.row.a[year] === "number");
  if (forYear) return forYear;
  return line.hits.find((hit) => Object.values(hit.row.a).some((value) => typeof value === "number")) ?? line.hits[0];
}

function amountOf(line: Checked) {
  const chosen = best(line);
  const yearCents = line.year && chosen ? chosen.row.a[String(line.year)] : undefined;
  if (typeof yearCents === "number") return { cents: yearCents, label: chosen.label };
  if (line.once) return { cents: line.once.c, label: line.once.s };
  return null;
}

function facts(line: Checked) {
  const chosen = best(line);
  const file = amountOf(line);
  const onThisYear = Boolean(line.year && chosen && typeof chosen.row.a[String(line.year)] === "number");
  return reasonLine({
    code: line.code,
    year: line.year,
    billedCents: line.billedCents,
    file: file ? { cents: file.cents, label: file.label, period: line.once && file.label === line.once.s ? line.once.t : undefined } : null,
    priors: onThisYear && chosen ? pricedYears(chosen.row.a) : [],
  });
}

function verdict(line: Checked) {
  return facts(line).verdict;
}

function labelFor(line: Checked) {
  const file = amountOf(line);
  if (!line.year) return "No year on the line";
  if (!file) return "Not on a loaded file";
  const period = line.once && file.label === line.once.s ? ` · ${line.once.t}` : "";
  if (line.billedCents === null) return `${line.year} file ${money(file.cents / 100)}${period}`;
  const gap = line.billedCents - file.cents;
  if (Math.abs(gap) <= 1) return `Matches ${line.year}${period}`;
  return `Off ${money(Math.abs(gap) / 100)} · file ${money(file.cents / 100)}`;
}

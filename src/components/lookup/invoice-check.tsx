import { useState, type FormEvent } from "react";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, type CheckLine } from "@/lib/lookup/check";
import { reasonLine } from "@/lib/lookup/reason";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { Link } from "@tanstack/react-router";

type Hit = { family: Family; label: string; row: Row };
type Checked = CheckLine & { hits: Hit[]; once: OnceRow | null; rest: OnceRow[] };

export function InvoiceCheck() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Checked[] | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function run(event?: FormEvent) {
    event?.preventDefault();
    const parsed = readInvoiceLines(text);
    setBusy(true);
    setDown(false);
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
    } catch {
      setRows(null);
      setDown(true);
    } finally {
      setBusy(false);
    }
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

  return (
    <form onSubmit={run}>
      <label className="inline-flex h-12 cursor-pointer items-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
        Choose the spreadsheet
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            file.text().then(setText);
          }}
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="invoice-lines">
        Or paste lines
        <textarea
          id="invoice-lines"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder={"CPT,DOS,Charge\n97110,2026-03-01,30.00\n90371,2026-08-01,138.23"}
          className="mt-1.5 w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-base text-ink"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="h-12 rounded-full border border-line px-5 text-sm font-medium text-ink" disabled={busy}>
          {busy ? "Checking" : "Check the invoice"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">A spreadsheet needs a code, a date, and an amount. Extra columns are ignored.</p>
      {down ? <p className="mt-4 text-sm font-medium text-deep">The year files did not load. The invoice is still here. Check it again.</p> : null}
      {rows && rows.length === 0 ? <p className="mt-4 text-sm font-medium text-deep">No code was on those lines.</p> : null}
      {rows && rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={place} className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
            Put these lines on the claim
          </button>
          {placed ? (
            <p className="text-sm text-ink" role="status">
              {placed}{" "}
              <Link to="/billing" className="font-medium text-teal">
                Open the claim.
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
                const word = reason.verdict;
                return (
                  <li key={key} className="rounded-2xl border border-line px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink tabular-nums">{line.code}{line.modifier ? `-${line.modifier}` : ""}</p>
                        <p className="text-sm text-muted">{line.date || "No date"} · billed {line.billedCents === null ? "nothing" : money(line.billedCents / 100)}</p>
                      </div>
                      <p className={word === "match" ? "text-right text-sm font-medium text-teal" : "text-right text-sm font-medium text-deep"}>{labelFor(line)}</p>
                    </div>
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
  const file = amountOf(line);
  return reasonLine({
    code: line.code,
    year: line.year,
    billedCents: line.billedCents,
    file: file ? { cents: file.cents, label: file.label, period: line.once && file.label === line.once.s ? line.once.t : undefined } : null,
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

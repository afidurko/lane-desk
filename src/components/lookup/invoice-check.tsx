import { useState, useId, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Empty, FIELD, LINK, PRIMARY, ReferenceNote, SECONDARY } from "@/components/ui";
import { IS_INTERNAL, PUBLIC_SCOPE } from "@/lib/config/mode";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, type CheckLine } from "@/lib/lookup/check";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { sampleInvoice } from "@/lib/demo/invoice-sample";
import { screen } from "@/lib/security/mesh";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";

type Hit = { family: Family; label: string; row: Row };
type Checked = CheckLine & {
  hits: Hit[];
  once: OnceRow | null;
  rest: OnceRow[];
};

export function InvoiceCheck() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Checked[] | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const areaId = useId();

  async function run(event?: FormEvent) {
    event?.preventDefault();
    setPlaced(null);
    setRefused(false);
    if (screen(text, "note").stop) {
      setRows(null);
      setRefused(true);
      return;
    }
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
        checked.push({
          ...line,
          hits,
          once,
          rest: list.filter((row) => row !== once),
        });
      }
      setRows(checked);
    } catch {
      setRows(null);
      setDown(true);
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    setBusy(true);
    setDown(false);
    try {
      const year = PUBLIC_SCOPE.year;
      const [a, b] = await Promise.all([findAcross("97110"), findAcross("97140")]);
      const centsOf = (hits: typeof a) => hits.find((hit) => hit.family === "physician")?.row.a[String(year)] ?? undefined;
      const lookup: Record<string, number | undefined> = { "97110": centsOf(a), "97140": centsOf(b) };
      const sample = sampleInvoice((code) => lookup[code], year);
      setText(sample.text);
      setSampleNote(sample.note);
      setRows(null);
      setRefused(false);
      setPlaced(null);
    } catch {
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
    setPlaced(
      skipped > 0
        ? `${added} lines are on the claim worksheet. ${skipped} had no year and stayed here.`
        : `${added} lines are on the claim worksheet.`,
    );
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
    <form onSubmit={run} aria-busy={busy}>
      <section aria-labelledby="inv-in">
        <h2 id="inv-in" className="sr-only">
          The invoice lines
        </h2>
        <label className="text-sm font-medium text-ink" htmlFor={areaId}>
          Paste invoice lines, one service per line
        </label>
        <textarea
          id={areaId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSampleNote(null);
          }}
          rows={6}
          aria-describedby={`${areaId}-help`}
          placeholder="One line per service: the code, the date of service, and the amount charged."
          className={`${FIELD} py-3`}
        />
        <p
          id={`${areaId}-help`}
          className="mt-2 rounded-xl border border-line bg-wash px-3 py-2 text-sm leading-relaxed text-ink"
          role="note"
        >
          <strong className="font-medium">De-identified only.</strong> Only the code, the date, and the amount are read. Delete patient
          names, member numbers, record numbers, and birth dates before you paste. Obvious identifier patterns are refused, but a name cannot be recognized, so remove it yourself.
        </p>
        {sampleNote ? <p className="mt-2 text-sm text-muted">{sampleNote}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={PRIMARY} disabled={busy || text.trim() === ""}>
            {busy ? "Checking" : "Check the invoice"}
          </button>
          <button type="button" className={SECONDARY} onClick={useSample} disabled={busy}>
            Use a synthetic sample invoice
          </button>
          <label className={`${SECONDARY} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal`}>
            Or load a spreadsheet file
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                file.text().then((value) => {
                  setText(value);
                  setSampleNote(null);
                });
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A spreadsheet needs a code, a date, and an amount. Extra columns are ignored. Nothing is sent anywhere.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="inv-out" aria-live="polite">
        <h2 id="inv-out" className="font-display text-2xl text-ink">
          Result
        </h2>
        {refused ? (
          <p className="mt-3 rounded-2xl border border-deep/40 bg-paper-2 px-4 py-4 text-sm leading-relaxed text-ink" role="alert">
            Refused. Something in the text looks like an identifier, such as a record number, date of birth, phone number, or email. Remove
            it and check again. Nothing was checked or kept.
          </p>
        ) : null}
        {down ? (
          <p className="mt-3 text-sm font-medium text-deep" role="alert">
            The fee file did not load. The invoice is still here. Check it again.
          </p>
        ) : null}
        {!rows && !refused && !down ? (
          <div className="mt-3">
            <Empty>Nothing checked yet. Paste lines or use the synthetic sample, then choose “Check the invoice”.</Empty>
          </div>
        ) : null}
        {rows && rows.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-deep">
            No code was found on those lines. Each line needs a five-character code such as 97110.
          </p>
        ) : null}
        {rows && rows.length > 0 ? (
          <div className="mt-3">
            <p className="text-sm text-ink">
              {rows.filter((line) => verdict(line) !== "match").length === 0
                ? `All ${rows.length} ${rows.length === 1 ? "line matches" : "lines match"} the file amount.`
                : `${rows.filter((line) => verdict(line) !== "match").length} of ${rows.length} lines do not match the file amount.`}
            </p>
            <ReferenceNote />
          </div>
        ) : null}
        {labels.map((label) => {
          const lines = groups.get(label) ?? [];
          const off = lines.filter((line) => verdict(line) !== "match").length;
          return (
            <div key={label} className="mt-6">
              <h3 className="font-display text-xl text-ink">
                {label}
                <span className="ml-2 text-base text-muted">
                  {lines.length} {lines.length === 1 ? "line" : "lines"}
                  {off > 0 ? ` · ${off} off` : " · matches"}
                </span>
              </h3>
              <ul className="mt-3 space-y-3">
                {lines.map((line, index) => {
                  const key = `${line.code}-${index}`;
                  const chosen = best(line);
                  const word = verdict(line);
                  return (
                    <li key={key} className="rounded-2xl border border-line bg-paper-2 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink tabular-nums">
                            {line.code}
                            {line.modifier ? `-${line.modifier}` : ""}
                          </p>
                          <p className="text-sm text-muted">
                            {line.date || "No date"} · billed {line.billedCents === null ? "nothing" : money(line.billedCents / 100)}
                          </p>
                        </div>
                        <p
                          className={
                            word === "match" ? "text-right text-sm font-medium text-teal" : "text-right text-sm font-medium text-deep"
                          }
                        >
                          {labelFor(line)}
                        </p>
                      </div>
                      {line.rest.length > 0 ? (
                        <p className="mt-2 text-xs text-muted">
                          Also on {line.rest.map((row) => `${row.s} ${money(row.c / 100)}`).join("; ")}.
                        </p>
                      ) : null}
                      {IS_INTERNAL && chosen ? (
                        <button
                          type="button"
                          onClick={() => setOpen(open === key ? null : key)}
                          className="mt-2 inline-flex h-11 items-center text-sm font-medium text-teal underline underline-offset-4"
                        >
                          {open === key ? "Hide the years" : "Show every year"}
                        </button>
                      ) : null}
                      {open === key && chosen ? <YearPrices row={chosen.row} mark={line.year} /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {rows && rows.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5">
            <Link to="/request" className={LINK}>
              Next: request a pilot or an invoice
            </Link>
            {IS_INTERNAL ? (
              <button type="button" onClick={place} className={SECONDARY}>
                Put these lines on the claim worksheet (internal)
              </button>
            ) : null}
            {placed ? (
              <p className="text-sm text-ink" role="status">
                {placed}{" "}
                <Link to="/billing" className={LINK}>
                  Open the worksheet.
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
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

function verdict(line: Checked) {
  if (outOfScope(line)) return "off";
  const file = amountOf(line);
  if (!file || line.billedCents === null) return "off";
  return Math.abs(line.billedCents - file.cents) <= 1 ? "match" : "off";
}

function outOfScope(line: Checked) {
  return !IS_INTERNAL && line.year !== null && line.year !== PUBLIC_SCOPE.year;
}

function labelFor(line: Checked) {
  const file = amountOf(line);
  if (outOfScope(line)) return `The public demo checks ${PUBLIC_SCOPE.year} dates only`;
  if (!line.year) return "No year on the line";
  if (!file) return "Not on a loaded file";
  const period = line.once && file.label === line.once.s ? ` · ${line.once.t}` : "";
  if (line.billedCents === null) return `${line.year} file ${money(file.cents / 100)}${period}`;
  const gap = line.billedCents - file.cents;
  if (Math.abs(gap) <= 1) return `Matches the ${line.year} file`;
  return `${gap > 0 ? "Over" : "Under"} by ${money(Math.abs(gap) / 100)} · file ${money(file.cents / 100)}`;
}

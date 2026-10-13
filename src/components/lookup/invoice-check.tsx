import { useState, useId, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Empty, FIELD, LINK, PRIMARY, ReferenceNote, SECONDARY } from "@/components/ui";
import { IS_INTERNAL, PUBLIC_SCOPE } from "@/lib/config/mode";
import { money } from "@/lib/desk/clock";
import { pricedForDay } from "@/lib/lookup/mppr-lines";
import { loadMppr } from "@/lib/pricing/books";
import { MPPR_EXPLAIN, MPPR_LABEL } from "@/lib/pricing/mppr";
import type { MpprInfo } from "@/lib/pricing/national";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, type CheckLine } from "@/lib/lookup/check";
import { pricedYears, reasonLine } from "@/lib/lookup/reason";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { sampleInvoice } from "@/lib/demo/invoice-sample";
import { screen } from "@/lib/security/mesh";
import { findAcross, loadOnce, Note2024, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";

type Hit = { family: Family; label: string; row: Row };
type Checked = CheckLine & {
  hits: Hit[];
  once: OnceRow | null;
  rest: OnceRow[];
  /** The file amount for this line after the therapy reduction, when the code is a therapy code. */
  adjusted: number | null;
  /** Therapy reduction values for the code on that year's file. */
  info: MpprInfo | null;
  /** This line is paid with the practice-expense cut. */
  reduced: boolean;
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
          adjusted: null,
          info: null,
          reduced: false,
        });
      }
      // Therapy lines on the same date of service are one day: the reduction runs across them.
      const tables = new Map<number, Record<string, MpprInfo>>();
      for (const year of new Set(checked.flatMap((line) => (line.year ? [line.year] : [])))) tables.set(year, await loadMppr(year));
      const priced = pricedForDay(
        checked.map((line) => ({ code: line.code, date: line.date, year: line.year, fileCents: physicianCents(line) })),
        (year) => tables.get(year) ?? {},
      );
      checked.forEach((line, index) => {
        if (!priced[index].info) return;
        line.info = priced[index].info;
        line.adjusted = priced[index].expectedCents;
        line.reduced = priced[index].reduced;
      });
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
      const [a, b, table] = await Promise.all([findAcross("97110"), findAcross("97140"), loadMppr(year)]);
      const centsOf = (hits: typeof a) => hits.find((hit) => hit.family === "physician")?.row.a[String(year)] ?? undefined;
      const full: Record<string, number | undefined> = { "97110": centsOf(a), "97140": centsOf(b) };
      // The two sample lines are on one date, so the second is a therapy line paid with the reduction.
      const day = pricedForDay(
        ["97110", "97140"].map((code) => ({ code, date: "sample", year, fileCents: full[code] ?? null })),
        () => table,
      );
      const lookup: Record<string, number | undefined> = {
        "97110": day[0].expectedCents ?? undefined,
        "97140": day[1].expectedCents ?? undefined,
      };
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
      const file = baseAmount(line);
      const name = line.hits[0]?.row.n || line.once?.n || line.code;
      addToOpenClaim({
        code: line.code,
        modifier: line.modifier,
        units: 1,
        chargeCents: line.billedCents,
        allowedCents: file?.cents ?? null,
        mppr: line.info ? { pe: line.info.pe, reducedCents: line.info.reducedCents } : undefined,
        schedule: noOffice(line) ? "Not priced in the office setting" : file ? `${file.label}, ${line.year}` : "Not on a loaded file",
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
    const label = noOffice(row) ? NOT_OFFICE : (amountOf(row)?.label ?? "Not on a file");
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }
  const labels = [...groups.keys()].sort((a, b) => Number(a === "Not on a file") - Number(b === "Not on a file"));
  const unpriced = (rows ?? []).filter((line) => verdict(line) === "none").length;
  const mismatched = (rows ?? []).filter((line) => verdict(line) === "off").length;
  const reducedLines = (rows ?? []).filter((line) => line.reduced).length;

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
              {mismatched === 0 && unpriced === 0
                ? `All ${rows.length} ${rows.length === 1 ? "line matches" : "lines match"} the file amount.`
                : mismatched === 0
                  ? `Every priced line matches the file amount. ${unpriced} ${unpriced === 1 ? "line is" : "lines are"} not priced in the office setting.`
                  : `${mismatched} of ${rows.length} lines do not match the file amount.${unpriced > 0 ? ` ${unpriced} ${unpriced === 1 ? "line is" : "lines are"} not priced in the office setting.` : ""}`}
            </p>
            {reducedLines > 0 ? (
              <p className="mt-2 rounded-xl border border-line bg-wash px-3 py-2 text-sm leading-relaxed text-ink" role="note">
                <strong className="font-medium">{MPPR_LABEL}.</strong> {MPPR_EXPLAIN} Lines with the same date are treated as one
                patient&apos;s day, one unit each. A line without a date is checked at the full rate.
              </p>
            ) : null}
            <ReferenceNote />
            {rows.some((line) => line.year === 2024 && line.hits.some((hit) => hit.family === "physician")) ? <Note2024 /> : null}
          </div>
        ) : null}
        {labels.map((label) => {
          const lines = groups.get(label) ?? [];
          const off = lines.filter((line) => verdict(line) === "off").length;
          const none = lines.filter((line) => verdict(line) === "none").length;
          return (
            <div key={label} className="mt-6">
              <h3 className="font-display text-xl text-ink">
                {label}
                <span className="ml-2 text-base text-muted">
                  {lines.length} {lines.length === 1 ? "line" : "lines"}
                  {off > 0 ? ` · ${off} off` : none > 0 ? "" : " · matches"}
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
                            word === "match"
                              ? "text-right text-sm font-medium text-teal"
                              : word === "none"
                                ? "text-right text-sm font-medium text-muted"
                                : "text-right text-sm font-medium text-deep"
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
                      <ol className="mt-2 space-y-1 text-sm text-muted">
                        {facts(line).steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      {IS_INTERNAL && chosen ? (
                        <button
                          type="button"
                          onClick={() => setOpen(open === key ? null : key)}
                          className="mt-2 inline-flex h-11 items-center text-sm font-medium text-teal underline underline-offset-4"
                        >
                          {open === key ? "Hide the years" : "Show every year"}
                        </button>
                      ) : null}
                      {open === key && chosen ? <YearPrices row={chosen.row} mark={line.year} family={chosen.family} /> : null}
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

const NOT_OFFICE = "Not priced in the office setting";

function best(line: Checked) {
  const year = line.year ? String(line.year) : "";
  const forYear = line.hits.find((hit) => typeof hit.row.a[year] === "number");
  if (forYear) return forYear;
  return line.hits.find((hit) => Object.values(hit.row.a).some((value) => typeof value === "number")) ?? line.hits[0];
}

/** The physician file amount for the line's year, before the therapy reduction. */
function physicianCents(line: Checked) {
  if (!line.year) return null;
  const cents = line.hits.find((hit) => hit.family === "physician")?.row.a[String(line.year)];
  return typeof cents === "number" ? cents : null;
}

/** CMS gives this code no office price for the line's year. It is not priced and not called a mismatch. */
function noOffice(line: Checked) {
  return line.year !== null && line.hits.some((hit) => hit.family === "physician" && hit.row.o?.includes(line.year as number));
}

function baseAmount(line: Checked) {
  if (noOffice(line)) return null;
  const chosen = best(line);
  const yearCents = line.year && chosen ? chosen.row.a[String(line.year)] : undefined;
  if (typeof yearCents === "number") return { cents: yearCents, label: chosen.label };
  if (line.once) return { cents: line.once.c, label: line.once.s };
  return null;
}

/** What the line should be: the file amount, cut by the therapy reduction when that applies. */
function amountOf(line: Checked) {
  const base = baseAmount(line);
  if (base && line.adjusted !== null && base.cents === physicianCents(line)) return { cents: line.adjusted, label: base.label };
  return base;
}

function facts(line: Checked) {
  if (outOfScope(line)) {
    return { verdict: "off" as const, steps: [`The public demo checks ${PUBLIC_SCOPE.year} dates only, so this line is not priced.`] };
  }
  if (noOffice(line)) {
    return { verdict: "none" as const, steps: [`${line.code} has no non-facility amount on the ${line.year} file. ${NOT_OFFICE}.`] };
  }
  const chosen = best(line);
  const file = amountOf(line);
  const onThisYear = Boolean(line.year && chosen && typeof chosen.row.a[String(line.year)] === "number");
  return reasonLine({
    code: line.code,
    year: line.year,
    billedCents: line.billedCents,
    file: file ? { cents: file.cents, label: file.label, period: line.once && file.label === line.once.s ? line.once.t : undefined } : null,
    priors: IS_INTERNAL && onThisYear && chosen ? pricedYears(chosen.row.a) : [],
  });
}

function verdict(line: Checked) {
  return facts(line).verdict;
}

function outOfScope(line: Checked) {
  return !IS_INTERNAL && line.year !== null && line.year !== PUBLIC_SCOPE.year;
}

function labelFor(line: Checked) {
  const file = amountOf(line);
  if (outOfScope(line)) return `The public demo checks ${PUBLIC_SCOPE.year} dates only`;
  if (!line.year) return "No year on the line";
  if (noOffice(line)) return NOT_OFFICE;
  if (!file) return "Not on a loaded file";
  const period = line.once && file.label === line.once.s ? ` · ${line.once.t}` : "";
  const cut = line.reduced ? ", therapy reduction applied" : "";
  if (line.billedCents === null) return `${line.year} file ${money(file.cents / 100)}${period}${cut}`;
  const gap = line.billedCents - file.cents;
  if (Math.abs(gap) <= 1) return `Matches reference (${line.year} Medicare file)${cut}`;
  return `Flagged for review: ${gap > 0 ? "over" : "under"} reference by ${money(Math.abs(gap) / 100)} · reference ${money(file.cents / 100)}${cut}`;
}

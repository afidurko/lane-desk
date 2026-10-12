import { useState, type FormEvent } from "react";
import { money } from "@/lib/desk/clock";
import { readInvoiceLines, type CheckLine } from "@/lib/lookup/check";
import { findAcross, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";

type Hit = { family: Family; label: string; row: Row };
type Checked = CheckLine & { hits: Hit[] };

const ORDER = ["Physician", "Ambulance", "Lab", "Equipment", "Not on a file"];

export function InvoiceCheck() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Checked[] | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function run(event?: FormEvent) {
    event?.preventDefault();
    const parsed = readInvoiceLines(text);
    setBusy(true);
    setDown(false);
    try {
      const checked: Checked[] = [];
      for (const line of parsed) {
        checked.push({ ...line, hits: await findAcross(line.code) });
      }
      setRows(checked);
    } catch {
      setRows(null);
      setDown(true);
    } finally {
      setBusy(false);
    }
  }

  const groups = new Map<string, Checked[]>();
  for (const row of rows ?? []) {
    const label = best(row)?.label ?? "Not on a file";
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }

  return (
    <form onSubmit={run}>
      <label className="block text-sm font-medium text-ink" htmlFor="invoice-lines">
        Invoice lines
        <textarea
          id="invoice-lines"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          placeholder={"97110 2026-03-01 28.27\nA0428 2025-06-12 277.09"}
          className="mt-1.5 w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-base text-ink"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink" disabled={busy}>
          {busy ? "Checking" : "Check the invoice"}
        </button>
        <label className="text-sm font-medium text-teal">
          Or choose a file
          <input
            type="file"
            accept=".csv,.txt,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              file.text().then(setText);
            }}
          />
        </label>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">One line, one code, a date, and the amount. Extra words are ignored.</p>
      {down ? <p className="mt-4 text-sm font-medium text-deep">The year files did not load. The invoice is still here. Check it again.</p> : null}
      {rows && rows.length === 0 ? <p className="mt-4 text-sm font-medium text-deep">No code was on those lines.</p> : null}
      {ORDER.filter((label) => groups.has(label)).map((label) => {
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
                const fileCents = line.year ? chosen?.row.a[String(line.year)] : undefined;
                const word = verdict(line);
                return (
                  <li key={key} className="rounded-2xl border border-line px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink tabular-nums">{line.code}{line.modifier ? `-${line.modifier}` : ""}</p>
                        <p className="text-sm text-muted">{line.date || "No date"} · billed {line.billedCents === null ? "nothing" : money(line.billedCents / 100)}</p>
                      </div>
                      <p className={word === "match" ? "text-sm font-medium text-teal" : "text-sm font-medium text-deep"}>{labelFor(line, fileCents)}</p>
                    </div>
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

function verdict(line: Checked) {
  const chosen = best(line);
  const fileCents = line.year ? chosen?.row.a[String(line.year)] : undefined;
  if (!chosen || typeof fileCents !== "number" || line.billedCents === null) return "off";
  return Math.abs(line.billedCents - fileCents) <= 1 ? "match" : "off";
}

function labelFor(line: Checked, fileCents: number | null | undefined) {
  if (!best(line)) return "Not on a file";
  if (!line.year) return "No year on the line";
  if (typeof fileCents !== "number") return `${line.year} has no amount`;
  if (line.billedCents === null) return `${line.year} file ${money(fileCents / 100)}`;
  const gap = line.billedCents - fileCents;
  if (Math.abs(gap) <= 1) return `Matches ${line.year}`;
  return `Off ${money(Math.abs(gap) / 100)} · file ${money(fileCents / 100)}`;
}

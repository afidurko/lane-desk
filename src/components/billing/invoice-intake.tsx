import { useState, type FormEvent } from "react";
import { claimsFromInvoice, entityTotal, parseInvoice, type Invoice } from "@/lib/billing/invoice";
import type { Books, Claim } from "@/lib/billing/billing";
import { money } from "@/lib/desk/clock";
import { prepareInvoice, readImportFile } from "@/lib/lookup/import-text";
import { rankInvoice } from "@/lib/team/rank";

export function InvoiceIntake({
  books,
  clientId,
  onClaims,
}: {
  books: Books;
  clientId: string;
  onClaims: (claims: Claim[]) => void;
}) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("2026-07-01");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function load(raw: string) {
    if (raw.trim().length < 4) {
      setMessage("The file is empty. Use a text or CSV invoice with a code and an amount.");
      return;
    }
    const next = parseInvoice(raw, books, date);
    if (next.lines.length === 0) {
      setMessage("No HCPCS or CPT code was found. A CSV needs a column named code, plus an amount.");
      return;
    }
    setInvoices((current) => [next, ...current]);
    setText("");
    setMessage(`${next.lines.length} lines across ${next.entities.length} entities.`);
  }

  function read(event: FormEvent) {
    event.preventDefault();
    load(text);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    readImportFile(file)
      .then((read) => {
        if ("error" in read) {
          setMessage(read.error);
          return;
        }
        const gate = rankInvoice({ look: 0, off: 0, match: 0 }, read.text);
        if (gate.status === "stop") {
          setText("");
          setMessage(gate.detail);
          return;
        }
        const safe = prepareInvoice(read.text);
        setText(safe);
        load(safe || read.text);
      })
      .catch(() => setMessage("That file could not be read."));
  }

  function prepare(invoice: Invoice) {
    if (!clientId) {
      setMessage("Add the organization first.");
      return;
    }
    const claims = claimsFromInvoice(invoice, clientId);
    onClaims(claims);
    setMessage(`${claims.length} claims opened, one per entity. Add the diagnosis on each, then mark ready.`);
  }

  function dispute(invoiceId: string, lineId: string, reason: string) {
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id !== invoiceId
          ? invoice
          : {
              ...invoice,
              lines: invoice.lines.map((line) => (line.id === lineId ? { ...line, dispute: reason } : line)),
            },
      ),
    );
    setMessage("Dispute noted on the invoice. The high alert stays until the line is corrected.");
  }

  return (
    <section className="mt-6 rounded-[10px] bg-paper-2 p-5">
      <h2 className="text-[22px] font-semibold tracking-tight text-ink">Import an invoice</h2>
      <p className="mt-2 text-sm text-muted">
        Bring a spreadsheet, a PDF, a Word document, a web page, a message, or a zip of those. A workbook is read from the code, the date, the units, the provider billed amount, and the amount you want to pay. A photo with no text stored in the file is not read. The file stays in this browser. It is not sent.
      </p>
      <form onSubmit={read} className="mt-4 grid gap-3">
        <label className="text-sm font-medium text-ink">
          Invoice file
          <input
            type="file"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
            className="mt-1.5 block w-full text-sm text-ink file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-teal file:px-4 file:text-sm file:font-medium file:text-teal-ink"
          />
        </label>
        <label className="text-sm font-medium text-ink">
          Date if a line has none
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-3 text-base" />
        </label>
        <label className="text-sm font-medium text-ink">
          Or paste the invoice
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder={"Entity: Olean General\n97110 Therapeutic exercise 2026-07-01 28.27"} className="mt-1.5 w-full rounded-[10px] bg-paper-2 px-3 py-2 text-base" />
        </label>
        <button type="submit" className="h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">Read pasted invoice</button>
      </form>
      {invoices.map((invoice) => (
        <article key={invoice.id} className="mt-5 rounded-[10px] bg-paper-2 p-4">
          <p className="text-sm text-ink">
            Amount due {invoice.amountDueCents === null ? "not on the invoice" : money(invoice.amountDueCents / 100)}. {invoice.lines.length} coded lines. {invoice.entities.length} entities.
            {invoice.alerts > 0 ? ` High alert on ${invoice.alerts} line${invoice.alerts === 1 ? "" : "s"}.` : " No high alerts."}
          </p>
          {invoice.entities.map((entity) => (
            <section key={entity} className="mt-4">
              <h3 className="text-[17px] font-semibold text-ink">{entity}</h3>
              <p className="text-sm text-muted">Entity total {(() => {
                const total = entityTotal(invoice, entity);
                return total === null ? "not listed" : money(total / 100);
              })()}.</p>
              <ul className="mt-2 space-y-2">
                {invoice.lines.filter((line) => line.entity === entity).map((line) => (
                  <li key={line.id} className={line.alert ? "rounded-2xl border border-deep bg-paper-2 px-4 py-3" : "rounded-[10px] bg-paper-2 px-4 py-3"}>
                    {line.alert ? <p className="text-[13px] text-deep">High alert</p> : null}
                    <p className="mt-1 text-[13px] text-muted">{line.category}</p>
                    <p className="mt-1 font-medium text-ink tabular-nums">{line.code}{line.modifier ? ` ${line.modifier}` : ""}</p>
                    <p className="mt-1 text-sm text-ink">{line.service}</p>
                    <p className="mt-1 text-sm text-muted">{line.date} · claimed {line.amountCents === null ? "not listed" : money(line.amountCents / 100)} · allowed {line.allowedCents === null ? "none on the Olean file" : money(line.allowedCents / 100)}</p>
                    {line.alert ? (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-deep">{line.alert.reason}</p>
                        <p className="mt-1 text-sm text-ink">Expected code {line.alert.expectedCode}. Expected cost {line.alert.expectedCents === null ? "not on the loaded file" : money(line.alert.expectedCents / 100)}.</p>
                        {line.dispute ? (
                          <p className="mt-1 text-sm text-ink">Dispute: {line.dispute}</p>
                        ) : (
                          <button type="button" onClick={() => dispute(invoice.id, line.id, "Amount or code disputed against the Olean file.")} className="mt-2 h-10 rounded-full border border-deep px-4 text-sm font-medium text-deep">Dispute this line</button>
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" onClick={() => prepare(invoice)} className="mt-4 h-12 rounded-full bg-ink px-5 text-sm font-medium text-paper">Open one claim per entity</button>
        </article>
      ))}
      {message ? <p className="mt-3 text-sm font-medium text-deep" role="status">{message}</p> : null}
    </section>
  );
}

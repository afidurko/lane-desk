import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/landing/shell";
import { money } from "@/lib/desk/clock";
import { workpaper } from "@/lib/account/workpaper";
import { readHeld, type HeldSheet } from "@/lib/account/held-sheet";
import { compareLine, type SheetLine } from "@/lib/lookup/sheet-book";
import { SheetSave } from "@/components/account/desk";

export function PayPage() {
  const [held, setHeld] = useState<HeldSheet | null>(null);
  useEffect(() => {
    setHeld(readHeld());
  }, []);
  const lines = held?.lines ?? [];
  const alone = lines.filter((line) => line.adminCents === null);
  const withAdmin = lines.length - alone.length;
  const paper = workpaper(alone);
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-6">
        <p className="text-[13px] text-muted">{held?.name ?? "No sheet yet"}</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">Pay</h1>
        {!held || lines.length === 0 ? (
          <div className="mt-6 overflow-hidden rounded-[10px] bg-paper-2">
            <p className="px-4 py-3 text-[17px] text-ink">Bring a sheet on Sheet. This page is only for lines with no third party.</p>
            <Link to="/" className="press flex min-h-12 items-center border-t border-line px-4 text-[17px] text-teal">Go to Sheet</Link>
          </div>
        ) : alone.length === 0 ? (
          <div className="mt-6 overflow-hidden rounded-[10px] bg-paper-2 px-4 py-3 text-[17px] text-ink">Every line names an administrator. Nothing to pay here.</div>
        ) : (
          <PayList lines={alone} youPay={paper.youPay} unknown={paper.unknown} withAdmin={withAdmin} />
        )}
      </main>
    </Shell>
  );
}

function PayList({ lines, youPay, unknown, withAdmin }: { lines: SheetLine[]; youPay: number; unknown: number; withAdmin: number }) {
  const groups = new Map<string, SheetLine[]>();
  for (const line of lines) {
    const key = line.year === null ? "No year" : String(line.year);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return (
    <>
      <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">No third party</h2>
      <div className="overflow-hidden rounded-[10px] bg-paper-2 px-4 py-3">
        <p className="text-[17px] leading-relaxed text-ink">The file says <span className="num">{money(youPay / 100)}</span>. A person pays that. Lane does not.</p>
        {unknown > 0 ? <p className="mt-2 text-[15px] text-wait">{unknown} {unknown === 1 ? "line has" : "lines have"} no file amount. That part was not added.</p> : null}
        {withAdmin > 0 ? <p className="mt-2 text-[15px] text-muted">{withAdmin} {withAdmin === 1 ? "line names" : "lines name"} an administrator. Those stay on Sheet.</p> : null}
      </div>
      <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">By year</h2>
      <div className="overflow-hidden rounded-[10px] bg-paper-2">
        {[...groups.entries()].map(([year, rows]) => {
          const slice = workpaper(rows);
          return (
            <details key={year} className="border-b border-line last:border-b-0">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-[17px] text-ink">
                {year}
                <span className="num">{slice.youPay ? money(slice.youPay / 100) : "—"}</span>
              </summary>
              <ul className="space-y-2 px-4 pb-4 text-[15px]">
                {rows.map((line, index) => {
                  const compared = compareLine(line);
                  return (
                    <li key={`${line.code}-${line.date}-${index}`} className="flex justify-between gap-3 text-ink">
                      <span>{line.code}{line.modifier ? ` ${line.modifier}` : ""}{line.units && line.units !== 1 ? ` · ${line.units}` : ""}</span>
                      <span className={compared.youPay === null ? "num text-wait" : "num text-ink"}>{compared.youPay === null ? "Unknown" : money(compared.youPay / 100)}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
      <div className="pt-4">
        <SheetSave lines={lines} name="lane-pay.xlsx" label="Save these lines" />
      </div>
      <p className="px-4 pt-2 text-[13px] leading-relaxed text-muted">The file opens on a form. These lines only. Nothing is sent. Lane is not the payer.</p>
    </>
  );
}

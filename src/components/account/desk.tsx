import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { money } from "@/lib/desk/clock";
import { selectLines, workpaper } from "@/lib/account/workpaper";
import { codeCrosswalk, crossNote, repeatedCodes } from "@/lib/lookup/crosswalk";
import { clientWorkbook, profileOf, reasonChain, type SheetLine } from "@/lib/lookup/sheet-book";

const SHEET_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function SheetSave({ lines, name, label }: { lines: SheetLine[]; name: string; label: string }) {
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const signature = lines.map((line) => [line.code, line.modifier, line.date, line.year ?? "", line.units ?? "", line.setting ?? "", line.schedule ?? "", line.lookupCents ?? "", line.billedCents ?? "", line.adminCents ?? "", line.fileCents ?? "", line.otherCents ?? "", line.seqRate ?? "", line.name, line.block ?? "", line.note ?? ""].join(":")).join("|");
  const fileRef = useRef<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const bytes = clientWorkbook(linesRef.current);
    const file = new File([bytes], name, { type: SHEET_TYPE });
    const next = URL.createObjectURL(file);
    fileRef.current = file;
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      if (fileRef.current === file) fileRef.current = null;
    };
  }, [signature, name]);
  if (!url) return <div className="flex min-h-12 w-full items-center justify-center rounded-[10px] bg-teal text-[17px] font-semibold text-teal-ink">{label}</div>;
  return (
    <a
      href={url}
      download={name}
      className="press flex min-h-12 w-full items-center justify-center rounded-[10px] bg-teal text-[17px] font-semibold text-teal-ink"
      onClick={(event) => {
        const file = fileRef.current;
        if (!file || typeof navigator.share !== "function" || !navigator.canShare?.({ files: [file] })) return;
        event.preventDefault();
        void navigator.share({ files: [file], title: name }).catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
        });
      }}
    >
      {label}
    </a>
  );
}

export function AccountantDesk({ lines, downloadName }: { lines: SheetLine[]; downloadName: string }) {
  const [year, setYear] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const all = workpaper(lines);
  const picked = year !== null || schedule !== null || code !== null;
  const paper = picked ? workpaper(selectLines(lines, { year, schedule, code })) : all;
  const crossCodes = code ? [code] : repeatedCodes(lines).slice(0, 3);
  const fileName = all.schedules.find((item) => item.id === schedule)?.name ?? null;
  const view = [year ? String(year) : null, fileName, code].filter(Boolean).join(" · ");
  const paperRef = useRef(paper);
  paperRef.current = paper;
  const [shownView, setShownView] = useState(view);
  const [shown, setShown] = useState(paper);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (shownView === view) return;
    setVisible(false);
    const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    const timer = window.setTimeout(() => {
      setShownView(view);
      setShown(paperRef.current);
      setVisible(true);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [view, shownView]);
  return (
    <section className="mt-2" aria-label="Accountant">
      <SheetSave lines={lines} name={downloadName} label="Save the spreadsheet" />
      <p className="px-4 pt-2 text-[13px] leading-relaxed text-muted">The file opens on a form. A blank amount stays blank. Nothing is sent.</p>
      <Head>Amounts</Head>
      <div className={visible ? "swap" : "swap swap-off"}>
        <Group>
          <Row label="You pay" value={money(shown.youPay / 100)} />
          <Row label="They want" value={shown.theirs ? money(shown.theirs / 100) : "—"} />
          <Row label="Difference" value={shown.difference ? money(shown.difference / 100) : "—"} />
          <Row label="Need a person" value={String(shown.unknown)} last tone={shown.unknown > 0 ? "text-wait" : "text-muted"} />
        </Group>
        <p className="px-4 pt-2 text-[13px] leading-relaxed text-muted" aria-live="polite">
          {shownView ? `Showing ${shownView}. ` : ""}
          {shown.lines - shown.exceptions.length} match. {Math.max(shown.exceptions.length - shown.unknown, 0)} do not match. {shown.unknown} need a person.
        </p>
      </div>
      {all.settings.office > 0 && all.settings.facility > 0 ? <p className="px-4 pt-2 text-[13px] text-muted">Office {money(all.settings.office / 100)}. Facility {money(all.settings.facility / 100)}. A facility line does not use the office amount.</p> : null}
      {all.years.length > 1 || all.schedules.length > 1 || code ? (
        <>
          <Head>Show</Head>
          <div className="flex gap-1 overflow-x-auto rounded-[10px] bg-line p-1">
            {all.years.length > 1 ? <Chip on={year === null} onClick={() => setYear(null)} label="All years" /> : null}
            {all.years.map((item) => <Chip key={item} on={year === item} onClick={() => setYear(item)} label={String(item)} />)}
            {all.schedules.length > 1 ? <Chip on={schedule === null} onClick={() => setSchedule(null)} label="All files" /> : null}
            {all.schedules.map((item) => <Chip key={item.id} on={schedule === item.id} onClick={() => setSchedule(item.id)} label={item.name} />)}
            {code ? <Chip on onClick={() => setCode(null)} label={`${code} only`} /> : null}
          </div>
        </>
      ) : null}
      {crossCodes.length > 0 ? (
        <>
          <Head>Same code</Head>
          <div className="space-y-3">
            {crossCodes.map((item) => {
              const rows = codeCrosswalk(lines, item);
              const text = crossNote(rows);
              return (
                <Group key={item}>
                  <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-line px-4 text-left" onClick={() => setCode(code === item ? null : item)}>
                    <span>
                      <span className="block text-base text-ink">{item}</span>
                      <span className="block text-[13px] text-muted">{text ?? "A different row is not the price."}</span>
                    </span>
                    <ChevronRight className={code === item ? "size-4 shrink-0 rotate-90 text-teal transition-transform duration-200" : "size-4 shrink-0 text-muted transition-transform duration-200"} />
                  </button>
                  {rows.map((row, index) => (
                    <Row
                      key={`${item}-${row.year}-${row.place}-${row.modifier}-${row.fileCents}-${row.lookupCents}`}
                      label={`${row.year ?? "No year"} · ${row.place}${row.modifier ? ` · ${row.modifier}` : ""}`}
                      value={row.fileCents === null ? "Unknown" : money(row.fileCents / 100)}
                      last={index === rows.length - 1}
                    />
                  ))}
                </Group>
              );
            })}
          </div>
        </>
      ) : null}
      <Head>Needs a look</Head>
      {shown.exceptions.length > 0 ? (
        <Group>
          <ul className={visible ? "swap" : "swap swap-off"}>
            {shown.exceptions.map((row, index) => (
              <li key={`${row.line.code}-${row.line.date}-${index}`} className={index === shown.exceptions.length - 1 ? "px-4 py-3" : "border-b border-line px-4 py-3"}>
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setCode(code === row.line.code ? null : row.line.code)}>
                  <span className="text-base text-ink">{profileOf(row.line)}{row.line.year ? ` · ${row.line.year}` : ""}</span>
                  <span className={`shrink-0 text-[13px] ${tone(row.compared.flag)}`}>{row.compared.flag}</span>
                </button>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                  {row.compared.theirs === null ? "They did not name an amount." : `They want ${money(row.compared.theirs / 100)}.`}
                  {row.compared.youPay === null ? " No file amount." : ` You pay ${money(row.compared.youPay / 100)}.`}
                  {row.compared.diff === null ? "" : ` Difference ${money(row.compared.diff / 100)}.`}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">{row.compared.why}</p>
                <details className="mt-2">
                  <summary className="flex cursor-pointer items-center justify-between text-[15px] text-teal">
                    How this was decided
                    <ChevronRight className="size-4" />
                  </summary>
                  <ol className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted">
                    {reasonChain(row.line).map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        </Group>
      ) : <p className="px-4 text-[15px] text-ink">Nothing to look at on this view.</p>}
      <details className="mt-6">
        <summary className="flex cursor-pointer items-center justify-between px-4 text-[13px] text-muted">
          What Lane did
          <ChevronRight className="size-4" />
        </summary>
        <ul className="mt-2 space-y-2 px-4 text-[13px] leading-relaxed text-muted">
          {paper.steps.map((step) => <li key={step.name}>{step.name}. {step.did} {step.didNot}</li>)}
        </ul>
      </details>
    </section>
  );
}

function Head({ children }: { children: ReactNode }) {
  return <h2 className="px-4 pt-7 pb-2 text-[13px] text-muted">{children}</h2>;
}

function Group({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[10px] bg-paper-2">{children}</div>;
}

function Row({ label, value, last, tone = "text-ink" }: { label: string; value: string; last?: boolean; tone?: string }) {
  return (
    <div className={last ? "flex min-h-12 items-center justify-between gap-3 px-4" : "flex min-h-12 items-center justify-between gap-3 border-b border-line px-4"}>
      <span className="text-[17px] text-ink">{label}</span>
      <span className={`num shrink-0 text-[17px] tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

function tone(flag: string) {
  if (/wrong|does not|not match/i.test(flag)) return "text-alert";
  if (/unknown|person|no file|blank/i.test(flag)) return "text-wait";
  return "text-teal";
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={on ? "press h-8 shrink-0 rounded-md bg-paper-2 px-3 text-[13px] font-semibold text-ink shadow-sm" : "press h-8 shrink-0 rounded-md px-3 text-[13px] font-medium text-muted"} aria-pressed={on}>
      {label}
    </button>
  );
}

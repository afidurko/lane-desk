import { useEffect, useRef, useState, type FormEvent } from "react";
import { money } from "@/lib/desk/clock";
import { addToOpenClaim } from "@/lib/billing/store";
import { readInvoiceLines, auditReport, gradeLookup, type CheckLine } from "@/lib/lookup/check";
import { rememberPayments, readPaymentMemory, type StoredAlert } from "@/lib/lookup/memory";
import { pricedYears, reasonLine, postedBeside, yearBeside } from "@/lib/lookup/reason";
import { pickOnce, type OnceRow } from "@/lib/lookup/once";
import { auditPrice, type AmbulanceRow, type DmeRow, type LabRow, type Priced } from "@/lib/lookup/schedule-price";
import { findAcross, loadOnce, YearPrices, type Family, type Row } from "@/components/lookup/year-lookup";
import { readImportFile } from "@/lib/lookup/import-text";
import { unknownBeside } from "@/lib/lookup/reason";
import { rankInvoice } from "@/lib/team/rank";
import { Link } from "@tanstack/react-router";
import { typeRollup } from "@/lib/lookup/code-types";
import { reportRows, theyNamed, type SheetLine } from "@/lib/lookup/sheet-book";
import { AccountantDesk } from "@/components/account/desk";
import { holdSheet } from "@/lib/account/held-sheet";
import { asksFrom } from "@/lib/lookup/crawl";
import { findPhrases, type CrawlHit } from "@/lib/lookup/crawl-fn";
import { detectPosted, rememberFound, type FoundCode } from "@/lib/lookup/detect";
import { fileHint, placeCue, placeOnFile, type Post } from "@/lib/lookup/place";
import { answerFor, rememberLookups, type Lookup } from "@/lib/lookup/persist";
import type { SavedRow } from "@/lib/lookup/saved-codes";

type Hit = { family: Family; label: string; row: Row };

function physicianPosts(line: CheckLine, hits: Hit[], posts: Post[]) {
  const next = posts.map((row) => ({ file: row.file, label: row.label, cents: row.cents, otherCents: row.otherCents }));
  const row = hits.find((hit) => hit.family === "physician")?.row;
  const year = line.year ? String(line.year) : "";
  if (!row || !year) return next;
  const modifier = line.modifier.toUpperCase();
  if ((modifier === "26" || modifier === "TC") && typeof row.p?.[modifier]?.[year] === "number") {
    next.push({ file: "pfs", label: `Physician, modifier ${modifier}, Rest of New York`, cents: row.p[modifier][year] as number, otherCents: null });
    return next;
  }
  if (line.setting !== "fac" && typeof row.a[year] === "number") next.push({ file: "pfs", label: "Physician, office, Rest of New York", cents: row.a[year] as number, otherCents: null });
  if (line.setting !== "nf" && typeof row.f?.[year] === "number") next.push({ file: "pfs", label: "Physician, facility, Rest of New York", cents: row.f[year] as number, otherCents: null });
  return next;
}
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

export function InvoiceCheck({ onOpen }: { onOpen?: (label: string | null) => void }) {
  const [code, setCode] = useState("");
  const [when, setWhen] = useState("");
  const [units, setUnits] = useState("1");
  const [charge, setCharge] = useState("");
  const [paid, setPaid] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Checked[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [memory, setMemory] = useState<StoredAlert[]>([]);
  const [hits, setHits] = useState<CrawlHit[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [pageNote, setPageNote] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  const [crawlTotal, setCrawlTotal] = useState(0);
  const wave = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const opened = useRef(onOpen);
  opened.current = onOpen;
  const loaded = useRef<{ saved: SavedRow[]; fees: Map<number, { dme: { rows: DmeRow[] } | null; lab: { rows: LabRow[] } | null; ambulance: { rows: AmbulanceRow[] } | null }> } | null>(null);

  useEffect(() => {
    const label = rows && rows.length > 0 ? (fileName?.replace(/\.[^.]+$/, "") ?? "The sheet") : null;
    opened.current?.(label);
    if (label && rows) holdSheet(label, sheetLines(rows));
  }, [rows, fileName]);

  useEffect(() => {
    setMemory(readPaymentMemory());
  }, []);

  async function runText(raw: string) {
    const gate = rankInvoice({ look: 0, off: 0, match: 0 }, raw);
    if (gate.status === "stop") {
      setFileName(null);
      setRows(null);
      setNote(gate.detail);
      setDown(false);
      setBusy(false);
      return;
    }
    const short = [...raw.matchAll(/^SHORT (\S+)$/gm)].map((item) => item[1]);
    const body = raw.replace(/^SHORT .+$/gm, "").trim();
    const parsed = readInvoiceLines(body);
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
      loaded.current = { saved, fees: feeByYear };
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
        const lookupOff = line.lookupCents !== null && (priced.cents === null || Math.abs(line.lookupCents - priced.cents) > 1);
        if (!settled && (priced.cents === null || lookupOff || line.schedule === "none" || line.schedule === "dme" || line.schedule === "ambulance")) {
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
          const posts = physicianPosts(line, hits, detected.posts);
          const placed = placeOnFile({ lookupCents: line.lookupCents, currentCents: priced.cents, posts });
          const keepProfile = line.setting !== null && priced.cents !== null && placed !== null && Math.abs(placed.cents - priced.cents) > 1;
          if (placed && !keepProfile) {
            priced = { cents: placed.cents, label: placed.label, block: null, note: [placed.note, related].filter(Boolean).join(" "), otherCents: placed.otherCents };
          } else if ((line.schedule === "none" || line.schedule === "other") && detected.use && priced.cents === null) {
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
        if (line.schedule === "pfs" && priced.cents !== null && line.lookupCents !== null) {
          const row = hits.find((hit) => hit.family === "physician")?.row;
          const modifier = line.modifier.toUpperCase();
          const part = modifier === "26" || modifier === "TC" ? row?.p?.[modifier] : undefined;
          const beside = postedBeside(line.lookupCents, priced.cents, line.year, [
            { name: "the office amount", amounts: part ? undefined : row?.a },
            { name: "the facility amount", amounts: part ? undefined : row?.f },
            { name: "the component amount", amounts: part },
          ]);
          if (beside) priced = { ...priced, note: [priced.note, beside].filter(Boolean).join(" ") };
          const column = modifier === "26" || modifier === "TC" ? row?.p?.[modifier] : line.setting === "fac" ? row?.f : row?.a;
          const older = yearBeside(line.lookupCents, line.year, column);
          if (older) priced = { ...priced, note: [priced.note, older].filter(Boolean).join(" ") };
        }
        checked.push({ ...line, hits, once, rest: list.filter((row) => row !== once), priced });
      }
      setRows(checked);
      try {
        findCodes(checked);
        rememberFound(found);
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
        // A note that could not be stored does not remove the amounts.
      }
    } catch {
      setRows(null);
      setDown(true);
    } finally {
      setBusy(false);
    }
  }

  function sheetLines(source: Checked[]) {
    return source.map((line): SheetLine => ({
      code: line.code,
      modifier: line.modifier,
      date: line.date,
      year: line.year,
      units: line.units,
      setting: line.setting,
      claim: line.claim ?? null,
      schedule: line.schedule,
      lookupCents: line.lookupCents,
      billedCents: line.billedCents,
      adminCents: theyNamed(line.adminCents, line.paidCents),
      seqRate: line.seqRate,
      fileCents: line.priced.cents,
      otherCents: line.priced.otherCents,
      name: line.hits[0]?.row.n || line.once?.n || line.code,
      block: line.priced.block,
      note: line.priced.note,
    }));
  }

  function applySpider(gathered: CrawlHit[]) {
    const book = loaded.current;
    if (!book) return;
    setRows((current) => {
      if (!current) return current;
      return current.map((line) => {
        if (line.priced.cents !== null) return line;
        const hits = gathered.filter((hit) => hit.found && hit.code === line.code);
        const only = hits.map((hit) => hit.file ?? fileHint(`${hit.url} ${hit.quote ?? ""} ${hit.note}`)).find((hint) => hint !== null) ?? null;
        const cue = placeCue(hits.map((hit) => `${hit.quote ?? ""} ${hit.note}`).join(" "));
        if (!only && !cue) return line;
        const fee = line.year ? book.fees.get(line.year) : undefined;
        const detected = detectPosted({
          code: line.code,
          modifier: line.modifier,
          year: line.year,
          month: line.month,
          schedule: "none",
          dme: fee?.dme?.rows ?? null,
          lab: fee?.lab?.rows ?? null,
          ambulance: fee?.ambulance?.rows ?? null,
          saved: book.saved,
        });
        let posts = physicianPosts(line, line.hits, detected.posts);
        if (cue === "fac") posts = posts.filter((row) => /facility/i.test(row.label));
        if (cue === "nf") posts = posts.filter((row) => /office/i.test(row.label));
        if (posts.length === 0) return line;
        const placed = placeOnFile({ lookupCents: line.lookupCents, currentCents: line.priced.cents, posts, only });
        if (!placed) return line;
        return { ...line, priced: { cents: placed.cents, label: placed.label, block: null, note: placed.note, otherCents: placed.otherCents } };
      });
    });
  }

  function findCodes(source?: Checked[]) {
    const token = wave.current + 1;
    wave.current = token;
    const lines = (source ?? rows)?.filter((line) => line.priced.cents === null) ?? [];
    if (lines.length === 0) {
      setFinding(false);
      setHits(null);
      setSeen(0);
      setCrawlTotal(0);
      setPageNote(null);
      return;
    }
    const asks = asksFrom(lines.map((line) => ({ code: line.code, year: line.year, unknown: true })));
    if (asks.length === 0) {
      setFinding(false);
      return;
    }
    setFinding(true);
    setPageNote(null);
    setHits([]);
    setSeen(0);
    setCrawlTotal(asks.length);
    const step = async () => {
      const chunks: typeof asks[] = [];
      for (let index = 0; index < asks.length; index += 4) chunks.push(asks.slice(index, index + 4));
      const groups: CrawlHit[][] = [];
      let slow = false;
      let done = 0;
      for (const chunk of chunks) {
        if (wave.current !== token) return;
        const group = await Promise.race([
          findPhrases({ data: { asks: chunk, hubs: false } }).then((rows) => ({ rows, slow: false })).catch(() => ({ rows: [] as CrawlHit[], slow: true })),
          new Promise<{ rows: CrawlHit[]; slow: boolean }>((resolve) => setTimeout(() => resolve({ rows: [], slow: true }), 8000)),
        ]);
        if (group.slow) slow = true;
        groups.push(group.rows);
        done += chunk.length;
        if (wave.current === token) setSeen(done);
      }
      if (wave.current !== token) return;
      const gathered = groups.flat();
      setHits(gathered);
      if (slow && !gathered.some((hit) => hit.found)) setPageNote("The public pages did not answer. The check is still here.");
      applySpider(gathered);
    };
    void step().finally(() => {
      if (wave.current === token) setFinding(false);
    });
  }

  function dollars(value: string) {
    const trimmed = value.trim().replace(/^\$/, "");
    if (!trimmed) return "";
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
    return Number(trimmed).toFixed(2);
  }

  function checkLine(event: FormEvent) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!/^(?:\d{4}[A-Z]|[A-Z]\d{4}|\d{5})(?:-[A-Z0-9]{2})?$/.test(clean)) {
      setNote("Enter a code, such as 97110.");
      return;
    }
    if (!when) {
      setNote("Enter the date of the service.");
      return;
    }
    const count = units.trim() || "1";
    if (!/^\d{1,3}(\.\d{1,3})?$/.test(count)) {
      setNote("Units must be a number.");
      return;
    }
    const billed = dollars(charge);
    const theyPaid = dollars(paid);
    if (billed === null || theyPaid === null) {
      setNote("An amount needs dollars and cents, such as 30.32. Leave it blank if you do not have it.");
      return;
    }
    const line = [clean, when, `${count} unit`, billed ? `charge ${billed}` : "", theyPaid ? `paid ${theyPaid}` : ""].filter(Boolean).join(" ");
    setFileName(null);
    void runText(line);
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
    <div>
      <form onSubmit={checkLine} className="rounded-[10px] bg-paper-2 p-4">
        <h2 className="text-[17px] font-semibold text-ink">One line</h2>
        <div className="mt-3 grid gap-3">
          <label className="text-sm font-medium text-ink">
            Code
            <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="97110" className="mt-1.5 h-12 w-full rounded-[10px] bg-paper px-3 text-base text-ink" />
          </label>
          <label className="text-sm font-medium text-ink">
            Date
            <input type="date" value={when} onChange={(event) => setWhen(event.target.value)} className="mt-1.5 h-12 w-full rounded-[10px] bg-paper px-3 text-base text-ink" />
          </label>
          <label className="text-sm font-medium text-ink">
            Units
            <input value={units} onChange={(event) => setUnits(event.target.value)} inputMode="decimal" className="mt-1.5 h-12 w-full rounded-[10px] bg-paper px-3 text-base text-ink" />
          </label>
          <label className="text-sm font-medium text-ink">
            Charge
            <input value={charge} onChange={(event) => setCharge(event.target.value)} inputMode="decimal" placeholder="Leave blank if you do not have it" className="mt-1.5 h-12 w-full rounded-[10px] bg-paper px-3 text-base text-ink" />
          </label>
          <label className="text-sm font-medium text-ink">
            They paid
            <input value={paid} onChange={(event) => setPaid(event.target.value)} inputMode="decimal" placeholder="Leave blank if you do not have it" className="mt-1.5 h-12 w-full rounded-[10px] bg-paper px-3 text-base text-ink" />
          </label>
        </div>
        <button type="submit" className="press mt-4 h-12 w-full rounded-[10px] bg-teal text-[17px] font-semibold text-teal-ink" disabled={busy}>
          {busy ? "Checking" : "Check this line"}
        </button>
      </form>
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="mt-3 overflow-hidden rounded-[10px] bg-paper-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-12 w-full items-center justify-center text-[17px] font-medium text-teal">
          {rows && rows.length > 0 ? "Choose another spreadsheet" : "Or choose a spreadsheet"}
        </button>
      </div>
      {fileName ? <p className="px-1 pt-2 text-[13px] text-ink">{fileName}</p> : null}
      {note ? <p className="mt-4 text-sm font-medium text-deep">{note}</p> : null}
      {down ? <p className="mt-4 text-sm font-medium text-deep">The year files did not load. The invoice is still here. Check it again.</p> : null}
      {rows && rows.length === 0 ? <p className="mt-4 text-sm font-medium text-deep">No code was on those lines.</p> : null}
      {rows && rows.length > 0 ? (
        <div className="rise mt-2">
          <AccountantDesk lines={sheetLines(rows)} downloadName={fileName ? fileName.replace(/\.[^.]+$/, "") + "-check.xlsx" : "lane-check.xlsx"} />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-ink">Keep these lines here</summary>
            <button type="button" onClick={place} className="mt-3 h-12 rounded-full border border-line px-5 text-sm font-medium text-ink">
              Save these lines
            </button>
            {placed ? (
              <p className="mt-2 text-sm text-ink" role="status">
                {placed}{" "}
                <Link to="/billing" className="font-medium text-teal">See saved lines.</Link>
              </p>
            ) : null}
          </details>
        </div>
      ) : null}
      {hits && hits.some((hit) => hit.found) ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-ink">{finding ? `Looking up ${seen} of ${crawlTotal}` : "Names from the public pages"}</summary>
          <ul className="mt-3 grid gap-2">
            {hits.filter((hit) => hit.found).slice(0, 8).map((hit) => (
              <li key={`${hit.host}-${hit.code}-${hit.url}`} className="text-sm text-ink">
                {hit.code}. {hit.quote ?? hit.note}
              </li>
            ))}
          </ul>
        </details>
      ) : finding ? <p className="mt-3 text-sm text-muted">Looking up {seen} of {crawlTotal}.</p> : pageNote ? <p className="mt-3 text-sm text-muted">{pageNote}</p> : null}
      {memory.length > 0 && !rows ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-ink">Last check</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {memory.slice(0, 5).map((item) => (
              <li key={item.id}>{item.reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {labels.map((label) => {
        const lines = groups.get(label) ?? [];
        const problems = lines.filter((line) => bucket(line) !== "match");
        const list = (
          <ul className="mt-3 space-y-3">
            {(problems.length > 0 ? problems : lines).map((line, index) => {
              const key = `${line.code}-${index}`;
              const chosen = best(line);
              const reason = facts(line);
              const tone = bucket(line);
              return (
                <li key={key} className={tone === "off" ? "rounded-2xl border border-alert bg-alert-wash px-4 py-3" : tone === "look" ? "rounded-2xl border border-wait bg-wait-wash px-4 py-3" : "rounded-[10px] bg-paper-2 px-4 py-3"}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink tabular-nums">{line.code}{line.modifier ? `-${line.modifier}` : ""}</p>
                      <p className="text-sm text-muted">{line.date || "No date"} · {amounts(line)}</p>
                    </div>
                    <p className={tone === "match" ? "text-right text-sm font-medium text-teal" : tone === "off" ? "text-right text-sm font-medium text-alert" : "text-right text-sm font-medium text-wait"}>{labelFor(line)}</p>
                  </div>
                  {tone !== "match" ? <p className="mt-2 text-sm font-medium text-ink" role="alert">{reviewed(line).reasons[0]}</p> : null}
                  <button type="button" onClick={() => setOpen(open === key ? null : key)} className="mt-2 text-sm text-teal">
                    {open === key ? "Hide why" : "Why"}
                  </button>
                  {open === key ? (
                    <>
                      <ol className="mt-2 space-y-1 text-sm text-muted">
                        {reason.steps.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                      {chosen ? <YearPrices row={chosen.row} mark={line.year} /> : null}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        );
        if (problems.length === 0) {
          return (
            <details key={label} className="mt-4">
              <summary className="cursor-pointer text-sm text-ink">{label}. {lines.length} match.</summary>
              {list}
            </details>
          );
        }
        return (
          <section key={label} className="mt-6">
            <h3 className="text-[17px] font-semibold text-ink">{label} <span className="text-base text-muted">{problems.length} to look at</span></h3>
            {list}
          </section>
        );
      })}
    </div>
  );
}

function leadText(lead: { totals: { payable: number; theirs: number; wrongGap: number } }) {
  const parts = [`You pay ${money(lead.totals.payable / 100)}.`];
  if (lead.totals.theirs) parts.push(`They want ${money(lead.totals.theirs / 100)}.`);
  if (lead.totals.wrongGap) parts.push(`${money(lead.totals.wrongGap / 100)} is the wrong schedule.`);
  else if (lead.totals.theirs) parts.push("Nothing is on the wrong schedule.");
  return parts.join(" ");
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
      choseCents: line.paidCents,
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
      <p className="mt-1 text-[17px] font-semibold text-ink tabular-nums">{lines.length}</p>
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

function SheetTable({ lines }: { lines: SheetLine[] }) {
  const report = reportRows(lines);
  const shown = report.flagged.length > 0 ? report.flagged : report.compared.slice(0, 12);
  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-sm text-ink">{report.compared.length} lines. {report.count("Match")} match. {report.flagged.length} flagged.{report.flagged.length > 0 ? ` Difference ${money(report.gap / 100)}.` : ""}</p>
      <table className="mt-2 w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="py-2 pr-3 font-medium">Code</th>
            <th className="py-2 pr-3 font-medium">Year</th>
            <th className="py-2 pr-3 font-medium">Their lookup</th>
            <th className="py-2 pr-3 font-medium">File</th>
            <th className="py-2 pr-3 font-medium">They want</th>
            <th className="py-2 pr-3 font-medium">You pay</th>
            <th className="py-2 pr-3 font-medium">Difference</th>
            <th className="py-2 font-medium">Flag</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={`${row.line.code}-${row.line.date}-${index}`} className="border-b border-line">
              <td className="py-2 pr-3">{row.line.code}</td>
              <td className="py-2 pr-3">{row.line.year ?? ""}</td>
              <td className="py-2 pr-3">{cents(row.lookup)}</td>
              <td className="py-2 pr-3">{cents(row.file)}</td>
              <td className="py-2 pr-3">{cents(row.theirs)}</td>
              <td className="py-2 pr-3">{cents(row.youPay)}</td>
              <td className="py-2 pr-3">{cents(row.diff)}</td>
              <td className="py-2">{row.flag}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cents(value: number | null) {
  return value === null ? "" : money(value / 100);
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { isMileage, lineMath, offsetApplies } from "@/lib/book/addons";
import { findPps, type PpsFile } from "@/lib/book/pps";
import { readBilling, writeBilling } from "@/lib/billing/store";
import { dateFits, FISCAL, QUARTER } from "@/lib/book/vintage";
import { money } from "@/lib/desk/clock";

type Choice = {
  id: string;
  label: string;
  name: string;
  cents: number | null;
  schedule: string;
  status: string;
};

export function OtherRates() {
  const [file, setFile] = useState<PpsFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const [units, setUnits] = useState(1);
  const [cut, setCut] = useState(false);
  const [offset, setOffset] = useState(false);
  const [weightOn, setWeightOn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dos, setDos] = useState("");

  useEffect(() => {
    fetch("/medicare-other.json")
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<PpsFile>;
      })
      .then(setFile)
      .catch(() => setFailed(true));
  }, []);

  const found = file && query.trim().length >= 3 ? findPps(file, query) : null;
  const choices: Choice[] = found
    ? [
        ...found.asp.map((row) => ({ id: `asp-${row.c}`, label: "Drug limit", name: `${row.name}. ${row.dose}`, cents: row.cents, schedule: "Part B drug payment limit", status: "" })),
        ...found.opps.map((row) => ({ id: `opps-${row.c}`, label: "Outpatient", name: row.name, cents: row.cents, schedule: "Hospital outpatient", status: row.si })),
        ...found.asc.map((row) => ({ id: `asc-${row.list}-${row.c}`, label: `Surgery center ${row.list}`, name: row.name, cents: row.cents, schedule: `Ambulatory surgical center ${row.list}`, status: "" })),
      ]
    : [];
  const drg = found?.drg[0] ?? null;
  const choice = choices.find((item) => item.id === picked) ?? choices.find((item) => item.cents !== null) ?? choices[0] ?? null;
  const canOffset = choice ? offsetApplies(choice.status) : false;
  const math = choice?.cents != null ? lineMath(choice.cents, units, canOffset && offset, cut) : null;
  const miles = isMileage(query);

  function changeQuery(value: string) {
    setQuery(value.toUpperCase());
    setPicked("");
    setUnits(1);
    setCut(false);
    setOffset(false);
    setWeightOn(false);
    setDos("");
    setNotice(null);
  }

  function addLine() {
    if (!dateFits(dos, QUARTER.start, QUARTER.end)) {
      setNotice("That date is outside October 1 through December 31, 2026. Nothing was added.");
      return;
    }
    if (!choice || choice.cents == null || !math) return;
    const book = readBilling();
    const claim = book.claims.find((item) => item.status === "draft");
    if (!claim) {
      setNotice("Open a worksheet first. Nothing was added.");
      return;
    }
    const note = [
      choice.name,
      canOffset && offset ? `${units} published units, then the 340B ratio 0.9951. Stored as one amount so the worksheet does not multiply it again.` : "",
      cut ? "Sequestration illustration, deductible treated as met." : "",
      `Date of service ${dos}. File window ${QUARTER.label}.`,
    ].filter(Boolean).join(" ");
    claim.lines.push({
      id: `line-${Date.now()}`,
      code: query.trim().toUpperCase(),
      modifier: "",
      units: canOffset && offset ? 1 : units,
      chargeCents: null,
      allowedCents: canOffset && offset ? math.allowedCents : choice.cents,
      schedule: choice.schedule,
      note,
      otherCents: null,
      otherSchedule: "",
    });
    writeBilling(book);
    setNotice("Added to the open worksheet. It was not sent.");
  }

  const unadjusted = file && drg && weightOn ? Math.round(Number(drg.weight) * (file.ipps.laborAtOrBelowOne + file.ipps.nonlaborAtOrBelowOne)) : null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl text-ink">Build a line</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Look up a code, then turn on only the add-ons that fit. The starting number is the published rate. Nothing here is sent.
      </p>
      <label className="mt-4 block max-w-md text-sm font-medium text-ink">
        Code or MS-DRG
        <input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="10005 or 90371" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-paper-2 px-3 text-base" />
      </label>
      {failed ? <p className="mt-3 text-sm font-medium text-deep">The rate file did not load.</p> : null}

      {choices.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {choices.map((item) => (
            <button key={item.id} type="button" onClick={() => { setPicked(item.id); setOffset(false); setNotice(null); }} className={item.id === (choice?.id ?? "") ? "h-11 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink" : "h-11 rounded-full border border-line px-4 text-sm font-medium text-ink"}>
              {item.label}{item.cents == null ? "" : ` ${money(item.cents / 100)}`}
            </button>
          ))}
        </div>
      ) : null}

      {choice ? (
        <div className="mt-4 rounded-2xl border border-line p-5">
          <p className="text-sm text-muted">{choice.schedule}{choice.status ? ` · status ${choice.status}` : ""}</p>
          <h3 className="mt-1 font-display text-3xl text-ink">{query.trim().toUpperCase()}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">{choice.name}</p>
          {choice.cents == null ? (
            <p className="mt-4 text-sm text-muted">This file has no separate rate, so there is nothing to add on.</p>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3">
                <button type="button" aria-label={miles ? "Fewer miles" : "Fewer units"} onClick={() => setUnits((value) => Math.max(1, value - 1))} className="h-12 w-12 rounded-full border border-line text-lg text-ink">−</button>
                <p className="min-w-16 text-center font-display text-3xl text-ink tabular-nums">{units}</p>
                <button type="button" aria-label={miles ? "More miles" : "More units"} onClick={() => setUnits((value) => Math.min(99, value + 1))} className="h-12 w-12 rounded-full border border-line text-lg text-ink">+</button>
                <p className="text-sm text-muted">{miles ? "miles" : units === 1 ? "unit" : "units"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" aria-pressed={cut} onClick={() => setCut((value) => !value)} className={cut ? "h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper" : "h-11 rounded-full border border-line px-4 text-sm font-medium text-ink"}>
                  Sequestration
                </button>
                {canOffset ? (
                  <button type="button" aria-pressed={offset} onClick={() => setOffset((value) => !value)} className={offset ? "h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper" : "h-11 rounded-full border border-line px-4 text-sm font-medium text-ink"}>
                    340B offset
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {canOffset ? "340B uses the 0.9951 ratio in the October 2026 Addendum B note, and only for this status." : "340B is not offered. This status is not in the Addendum B list."}
                {" "}Sequestration is 2 percent of the Medicare share, and only if the deductible is already met.
              </p>
              {math ? (
                <div className="mt-5">
                  <p className="font-display text-4xl text-ink tabular-nums">{money(math.allowedCents / 100)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">
                    {units} × {money(choice.cents / 100)}
                    {canOffset && offset ? ", then the 340B ratio" : ""}
                    {math.picture ? `. Medicare share ${money(math.picture.paid)} after the cut. Coinsurance ${money(math.picture.coinsurance)}.` : ". No cut applied."}
                    {" "}Not a payment.
                  </p>
                </div>
              ) : null}
              <label className="mt-4 block text-sm font-medium text-ink">
                Date of service
                <input type="date" value={dos} onChange={(event) => { setDos(event.target.value); setNotice(null); }} className="mt-1.5 h-12 w-full max-w-xs rounded-xl border border-line bg-paper-2 px-3 text-base" />
              </label>
              <p className="mt-2 text-sm leading-relaxed text-muted">This drug, outpatient, and surgery-center file is only {QUARTER.label}. A date in another quarter needs that quarter’s file, and it is not loaded.</p>
              <button type="button" onClick={addLine} className="mt-5 h-12 rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">Add to the open worksheet</button>
              {notice ? <p className="mt-3 text-sm text-ink">{notice} {notice.startsWith("Open") ? <Link to="/billing" className="underline">Go to Billing.</Link> : notice.startsWith("Added") ? <Link to="/billing" className="underline">See the worksheet.</Link> : null}</p> : null}
            </>
          )}
        </div>
      ) : null}

      {drg && file ? (
        <div className="mt-4 rounded-2xl border border-line p-5">
          <p className="text-sm text-muted">Inpatient</p>
          <h3 className="mt-1 font-display text-3xl text-ink">MS-DRG {drg.drg}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">{drg.title}. Weight {drg.weight}.</p>
          <button type="button" aria-pressed={weightOn} onClick={() => setWeightOn((value) => !value)} className={weightOn ? "mt-4 h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper" : "mt-4 h-11 rounded-full border border-line px-4 text-sm font-medium text-ink"}>
            Unadjusted amount
          </button>
          {unadjusted != null ? (
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {money(unadjusted / 100)}. That is the weight times the national standardized amount for a wage index at or below 1. Wage index, DSH, teaching, and outliers are not in it. The weight file is fiscal year 2027, {FISCAL.label}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">Off, so this stays a weight. The weight file is fiscal year 2027, {FISCAL.label}, not a calendar-year price.</p>
          )}
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(file?.bases ?? []).map((item) => (
          <li key={item.name} className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">
            <span className="font-medium">{item.name}.</span> {item.cents === null ? "" : `${money(item.cents / 100)}. `}{item.note}
          </li>
        ))}
      </ul>
    </section>
  );
}

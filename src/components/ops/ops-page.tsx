import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { countStatus, isWatchReport, type WatchReport, type WatchStatus } from "@/lib/ops/watch";
import { regulate, type Duty } from "@/lib/watch/regulate";

function statusClass(status: WatchStatus) {
  if (status === "current") return "text-sm font-medium text-teal";
  if (status === "gap") return "text-sm font-medium text-deep";
  return "text-sm font-medium text-ink";
}

function statusLabel(status: WatchStatus) {
  if (status === "current") return "Current";
  if (status === "gap") return "Gap";
  return "Due";
}

export function OpsPage() {
  const [report, setReport] = useState<WatchReport | null>(null);
  const [missing, setMissing] = useState(false);
  const [duties, setDuties] = useState<Duty[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/file-status.json").then((response) => (response.ok ? response.json() : null)),
      fetch("/years/physician/9.json").then((response) => (response.ok ? response.json() : null)),
      fetch("/years/ambulance/A.json").then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([status, physician, ambulance]) => {
        if (cancelled) return;
        if (!isWatchReport(status)) setMissing(true);
        else setReport(status);
        const files = status && typeof status === "object" ? (status as { place?: string; files?: unknown[] }) : null;
        const physicianFile = physician && typeof physician === "object" ? (physician as { "97110"?: { n?: string; a?: Record<string, number | null>; s?: string } })["97110"] ?? null : null;
        const ambulanceFile = ambulance && typeof ambulance === "object" ? (ambulance as { A0428?: { n?: string; a?: Record<string, number | null> } }).A0428 ?? null : null;
        setDuties(regulate({ physician: physicianFile, ambulance: ambulanceFile, status: files }));
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
          setDuties(regulate({ physician: null, ambulance: null, status: null }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = report ? countStatus(report.files, "current") : 0;
  const gap = report ? countStatus(report.files, "gap") : 0;

  return (
    <Shell>
      <main className="mx-auto max-w-6xl overflow-x-hidden px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Files</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          What is loaded, and what is next.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Rest of New York, Olean 14760, MAC 13282, locality 99. This page does not download a new schedule and it does not submit a claim. The preview can stop. The published site is the last deploy, and these checks run from the repository on every push.
        </p>
        <SelfCheck duties={duties} />

        {missing ? (
          <p className="mt-8 text-sm font-medium text-deep" role="status">
            The file watch has not reported yet.
          </p>
        ) : null}

        {!report && !missing ? <p className="mt-8 text-sm text-muted">Checking the file watch.</p> : null}

        {report ? (
          <>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="min-w-0 rounded-2xl border border-line bg-paper-2 p-4">
                <dt className="text-xs font-medium tracking-widest text-teal uppercase">Current</dt>
                <dd className="mt-2 font-display text-3xl text-ink tabular-nums">{current}</dd>
              </div>
              <div className="min-w-0 rounded-2xl border border-line bg-paper-2 p-4">
                <dt className="text-xs font-medium tracking-widest text-deep uppercase">Gap</dt>
                <dd className="mt-2 font-display text-3xl text-deep tabular-nums">{gap}</dd>
              </div>
              <div className="min-w-0 rounded-2xl border border-line bg-paper-2 p-4">
                <dt className="text-xs font-medium tracking-widest text-teal uppercase">Built</dt>
                <dd className="mt-2 font-display text-2xl break-words text-ink">{report.built}</dd>
              </div>
            </dl>

            {report.place ? <p className="mt-6 text-sm text-muted">{report.place}</p> : null}
            {report.note ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{report.note}</p> : null}

            <ul className="mt-8 space-y-3">
              {report.files.map((file) => (
                <li
                  key={file.id}
                  className={
                    file.status === "gap"
                      ? "min-w-0 rounded-2xl border border-line bg-wash px-4 py-3"
                      : "min-w-0 rounded-2xl border border-line px-4 py-3"
                  }
                >
                  <p className="font-medium break-words text-ink">{file.name}</p>
                  <p className={statusClass(file.status)}>{statusLabel(file.status)}</p>
                  <p className="mt-1 text-sm leading-relaxed break-words text-ink">
                    {file.cadence}. Loaded: {file.loaded}. Next: {file.next}.
                    {file.rows === null ? "" : ` ${file.rows.toLocaleString()} rows.`}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed break-words text-ink">{file.detail}</p>
                  <p className="mt-1 text-xs leading-relaxed break-words text-muted">{file.source}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </Shell>
  );
}

function SelfCheck({ duties }: { duties: Duty[] | null }) {
  const failed = duties?.filter((duty) => !duty.ok).length ?? 0;
  const teams = [...new Set(duties?.map((duty) => duty.team) ?? [])];
  return (
    <section className="mt-8" aria-label="Self check">
      <h2 className="font-display text-3xl text-ink">Self check</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {duties ? (failed === 0 ? "All checks passed." : `${failed} failed.`) : "Running the checks."} File, Invoice, Code, and Files each own a part. They read the loaded amounts. They do not keep a server alive and they do not send a claim.
      </p>
      {teams.map((team) => (
        <div key={team} className="mt-4">
          <h3 className="text-xs font-medium tracking-widest text-teal uppercase">{team}</h3>
          <ul className="mt-2 space-y-2">
            {duties?.filter((duty) => duty.team === team).map((duty) => (
              <li key={`${duty.team}-${duty.sub}`} className="rounded-2xl border border-line px-4 py-3">
                <p className="font-medium text-ink">{duty.sub} · {duty.name}</p>
                <p className={duty.ok ? "text-sm font-medium text-teal" : "text-sm font-medium text-deep"}>{duty.ok ? "Pass" : "Fail"}</p>
                <p className="mt-1 text-sm text-muted">{duty.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

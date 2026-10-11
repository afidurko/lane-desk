import { useEffect, useState } from "react";
import { Shell } from "@/components/landing/shell";
import { countStatus, isWatchReport, type WatchReport, type WatchStatus } from "@/lib/ops/watch";

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

  useEffect(() => {
    let cancelled = false;
    fetch("/file-status.json")
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (cancelled) return;
        if (!isWatchReport(value)) {
          setMissing(true);
          return;
        }
        setReport(value);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
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
          Rest of New York, Olean 14760, MAC 13282, locality 99. This page does not download a new schedule and it does not submit a claim. A Monday job on the repository checks that the 2026 files are still there.
        </p>

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

export type WatchStatus = "current" | "due" | "gap";

export type WatchFile = {
  id: string;
  name: string;
  cadence: string;
  loaded: string;
  source: string;
  rows: number | null;
  status: WatchStatus;
  next: string;
  detail: string;
};

export type WatchReport = {
  built: string;
  place: string;
  note: string;
  files: WatchFile[];
};

const STATUSES: readonly WatchStatus[] = ["current", "due", "gap"];

export function countStatus(files: WatchFile[], status: WatchStatus): number {
  return files.filter((file) => file.status === status).length;
}

function isWatchStatus(value: unknown): value is WatchStatus {
  return typeof value === "string" && STATUSES.includes(value as WatchStatus);
}

function isWatchFile(value: unknown): value is WatchFile {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const rowsOk = row.rows === null || (typeof row.rows === "number" && Number.isFinite(row.rows) && row.rows >= 0);
  return (
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.cadence === "string" &&
    typeof row.loaded === "string" &&
    typeof row.source === "string" &&
    rowsOk &&
    isWatchStatus(row.status) &&
    typeof row.next === "string" &&
    typeof row.detail === "string"
  );
}

/** Rejects a missing files array, a bad status, or any other shape that is not a watch report. */
export function isWatchReport(value: unknown): value is WatchReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  if (typeof report.built !== "string" || typeof report.place !== "string" || typeof report.note !== "string") return false;
  if (!Array.isArray(report.files)) return false;
  return report.files.every(isWatchFile);
}

export type Interest = {
  id: string;
  family: "physician" | "ambulance" | "lab" | "dme";
  year: number;
  code: string;
  name: string;
};

const KEY = "lane-interest";

export function readInterest(): Interest[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isInterest);
  } catch {
    return [];
  }
}

export function writeInterest(rows: Interest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 200)));
}

function isInterest(value: unknown): value is Interest {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.family === "string" && typeof row.year === "number" && typeof row.code === "string" && typeof row.name === "string";
}

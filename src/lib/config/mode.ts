/**
 * DEMO_MODE decides which prices a visitor can see.
 *
 *   public   (default)  National 2026 Medicare physician amounts only. No Rest of New York
 *                       figures, no lab (CLFS) data, no billing worksheet, no internal tabs.
 *   internal            Everything the desk has: Rest of NY, 2020-2026, lab, worksheet, files.
 *
 * Set VITE_DEMO_MODE=internal to turn internal on. Anything else, or nothing, is public.
 * Rest of NY figures stay internal until Shield, Andrea and Aaron clear them.
 */
export type DemoMode = "public" | "internal";

export function resolveMode(raw: string | undefined | null): DemoMode {
  return String(raw ?? "")
    .trim()
    .toLowerCase() === "internal"
    ? "internal"
    : "public";
}

const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEMO_MODE;

export const DEMO_MODE: DemoMode = resolveMode(fromEnv);
export const IS_INTERNAL = DEMO_MODE === "internal";

/** The one sentence that sits next to every price. Do not reword it. */
export const REFERENCE_NOTE = "Medicare reference price, not a payment";

/** Lane covers New York only. Public mode still shows the national reference price, not a New York locality. */
export const PUBLIC_SCOPE = {
  year: 2026,
  label: "Medicare national, non-facility, 2026",
  short: "National, 2026",
} as const;

export const INTERNAL_SCOPE = {
  label: "Rest of New York, MAC 13282, locality 99, non-facility",
} as const;

export function scopeLabel(mode: DemoMode = DEMO_MODE) {
  return mode === "internal" ? INTERNAL_SCOPE.label : PUBLIC_SCOPE.label;
}

/** Years a price screen may show. Public shows 2026 only. */
export function visibleYears(all: readonly number[], mode: DemoMode = DEMO_MODE) {
  return mode === "internal" ? all : all.filter((year) => year === PUBLIC_SCOPE.year);
}

/** Files that must never be in a public build. Used by the prune step and its test. */
export const NEVER_PUBLIC = [
  /^clfs-\d{4}\.json$/, // CLFS lab files: AMA license pending
  /^years\/lab\//,
];

/** Rest of NY and other internal-only data. Removed from a public build. */
export const INTERNAL_ONLY = [
  /^afs-\d{4}\.json$/,
  /^dme-\d{4}\.json$/,
  /^pfs-(2020|2021|2022|2023|2024|2025)\.json$/,
  /^years\//,
  /^once\//,
  /^ny-medicaid\.json$/,
  /^ny-more\.json$/,
  /^found-rates\.json$/,
  /^gap-rates\.json$/,
  /^medicare-other\.json$/,
  /^team-findings\.json$/,
  /^file-status\.json$/,
  /^proof-internal\.json$/,
];

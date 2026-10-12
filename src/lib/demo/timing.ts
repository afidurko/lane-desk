import { review } from "@/lib/desk/clock";

export const RUNS = 200;

export type Timing = { seconds: number; runs: number };

/** Average seconds for the real rule-based coder to read one note. Measured, not staged. */
export function timeCoder(note: string, rates?: Record<string, number>, runs = RUNS): Timing {
  const started = performance.now();
  for (let i = 0; i < runs; i += 1) review(note, rates);
  return { seconds: (performance.now() - started) / 1000 / runs, runs };
}

/** Seconds, never milliseconds. */
export function formatSeconds(seconds: number) {
  if (seconds < 0.0001) return "under 0.0001 seconds";
  return `${seconds.toFixed(4)} seconds`;
}

/** Verbatim. The label for our side of any timing. */
export const OUR_SIDE_LABEL = "our side, measured: synthetic notes, rule-based coder, provisional";

/** The pull has to stay at or above this share of the posted amounts. */
export const DETECTION_FLOOR = 0.93;

export function detectionRate(cases: { posted: number; pulled: number | null }[]) {
  if (cases.length === 0) return 0;
  const correct = cases.filter((row) => row.pulled !== null && Math.abs(row.pulled - row.posted) <= 1).length;
  return correct / cases.length;
}

/**
 * Decides whether a production build may be internal. Used by vite.config.ts on `vite build`.
 *
 *   VITE_DEMO_MODE unset / anything but "internal"   -> public build (always allowed).
 *   VITE_DEMO_MODE=internal                          -> refused unless LANE_INTERNAL_BUILD=1 is also set,
 *                                                       and refused on ANY Vercel build (VERCEL=1 or VERCEL_ENV set),
 *                                                       even with the flag. A Vercel deploy can therefore only be public.
 *
 * Dev (`vite dev`) is not a production build and is not checked here.
 */
export function buildModeDecision(env) {
  const wantsInternal = String(env.VITE_DEMO_MODE ?? "").trim().toLowerCase() === "internal";
  if (!wantsInternal) return { mode: "public", error: null };
  const onVercel = Boolean(String(env.VERCEL ?? "").trim() || String(env.VERCEL_ENV ?? "").trim());
  if (onVercel) {
    return {
      mode: null,
      error: `[demo-mode] Refusing an internal build on Vercel (VERCEL_ENV=${String(env.VERCEL_ENV ?? "").trim() || "unset"}). A Vercel deploy is public only. Unset VITE_DEMO_MODE in the Vercel project env.`,
    };
  }
  if (String(env.LANE_INTERNAL_BUILD ?? "").trim() !== "1") {
    return {
      mode: null,
      error: "[demo-mode] VITE_DEMO_MODE=internal needs LANE_INTERNAL_BUILD=1 for a production build (local internal e2e only). Use `npm run build:internal`.",
    };
  }
  return { mode: "internal", error: null };
}

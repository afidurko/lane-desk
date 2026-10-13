import { INTERNAL_DEFAULT_LOCALITY } from "@/lib/config/internal-only";
/**
 * Lane covers New York only.
 * The internal default locality lives in internal-only.ts.
 * Other New York localities (Manhattan, NYC suburbs/Long Island, Poughkeepsie/N NYC suburbs, Queens)
 * are offered in the internal build only, and only when the loaded fee file carries them.
 */
/** Internal: Rest of New York. Public: a placeholder (the public build prices the national file and never uses it). */
export const DEFAULT_LOCALITY = INTERNAL_DEFAULT_LOCALITY;

export type LocalityLike = { mac: string; number: string; name: string; state?: string };

export function keyOf(item: { mac: string; number: string }) {
  return `${item.mac}/${item.number}`;
}

/** Only New York localities the loaded file carries. Anything else is dropped. */
export function nyLocalities<T extends LocalityLike>(all: readonly T[]): T[] {
  return all.filter((item) => item.state === "NY");
}

export function localityName(item: LocalityLike) {
  return item.name
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Nyc", "NYC")
    .replace("Poughkpsie/N", "Poughkeepsie/N");
}

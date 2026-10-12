/**
 * Lane covers New York only.
 * Default locality is Rest of New York, MAC 13282, locality 99.
 * Other New York localities (Manhattan, NYC suburbs/Long Island, Poughkeepsie/N NYC suburbs, Queens)
 * are offered in the internal build only, and only when the loaded fee file carries them.
 */
export const DEFAULT_LOCALITY = { mac: "13282", number: "99", key: "13282/99", name: "Rest of New York" } as const;

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

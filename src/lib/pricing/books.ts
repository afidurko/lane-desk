import type { PfsFile } from "@/lib/book/price";
import { IS_INTERNAL } from "@/lib/config/mode";
import { DEFAULT_LOCALITY } from "@/lib/config/ny";
import { localityPrices } from "@/lib/pricing/locality";
import { loadNational, type MpprInfo } from "@/lib/pricing/national";

const cache = new Map<number, Promise<Record<string, MpprInfo>>>();

/**
 * Therapy reduction values for one year, from the loaded file.
 * Public: the national 2026 file only. Internal: Rest of New York from that year's full file.
 */
export function loadMppr(year: number): Promise<Record<string, MpprInfo>> {
  const hit = cache.get(year);
  if (hit) return hit;
  const made: Promise<Record<string, MpprInfo>> = !IS_INTERNAL
    ? year === 2026
      ? loadNational().then((national) => national.mppr)
      : Promise.resolve({})
    : fetch(`/pfs-${year}.json`).then(async (response) => {
        if (!response.ok) throw new Error(`The ${year} file did not load.`);
        return localityPrices((await response.json()) as PfsFile, DEFAULT_LOCALITY.key).mppr;
      });
  cache.set(
    year,
    made.catch((error) => {
      cache.delete(year);
      throw error;
    }),
  );
  return cache.get(year) as Promise<Record<string, MpprInfo>>;
}

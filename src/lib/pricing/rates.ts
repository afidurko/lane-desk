import { IS_INTERNAL, PUBLIC_SCOPE } from "@/lib/config/mode";
import { DEFAULT_LOCALITY, keyOf, localityName } from "@/lib/config/ny";
import { fromFile } from "@/lib/desk/clock";
import type { PfsFile } from "@/lib/book/price";
import { localityPrices } from "@/lib/pricing/locality";
import { loadNational, notOfficeOf, ratesOf, type MpprInfo, type National } from "@/lib/pricing/national";

export type RateSet = {
  /** The locality these amounts were computed for (the default key in a public build). */
  key: string;
  rates: Record<string, number>;
  names: Map<string, string>;
  release: string;
  /** What the amounts are, in words. Shown next to every price. */
  scope: string;
  /** New York localities the loaded file carries. Empty in a public build. */
  localities: { key: string; label: string }[];
  /** Therapy multiple-procedure reduction values, by code. */
  mppr: Record<string, MpprInfo>;
  /** Payable codes CMS gives no office price. They are not priced here. */
  notOffice: ReadonlySet<string>;
};

/**
 * Public: national 2026 non-facility, from the loaded file.
 * Internal: a New York locality from the same file, Rest of New York (13282/99) by default.
 * Lane covers New York only, so no other state is ever offered.
 */
/** True only when the loaded set was computed for the locality on screen. Never price with a set for another area. */
export function ratesFor(set: RateSet | null, localityKey: string): RateSet | null {
  return set !== null && set.key === localityKey ? set : null;
}

let pfsFile: Promise<PfsFile> | null = null;
function loadPfs2026(): Promise<PfsFile> {
  pfsFile ??= fetch("/pfs-2026.json").then((response) => {
    if (!response.ok) throw new Error("The 2026 file did not load.");
    return response.json() as Promise<PfsFile>;
  });
  pfsFile.catch(() => {
    pfsFile = null;
  });
  return pfsFile;
}

export async function loadRates(localityKey: string = DEFAULT_LOCALITY.key): Promise<RateSet> {
  const national: National = await loadNational();
  // Public: no short names (CPT text). The public national file carries none; the desk shows its own plain label or the code.
  const names = new Map<string, string>();
  if (!IS_INTERNAL) {
    const notOffice = notOfficeOf(national);
    return {
      key: localityKey,
      rates: fromFile(ratesOf(national), { mppr: national.mppr, notOffice }),
      names,
      release: national.release,
      scope: PUBLIC_SCOPE.label,
      localities: [],
      mppr: national.mppr,
      notOffice,
    };
  }

  const file = await loadPfs2026();
  const { place, rates, mppr, notOffice, localities: ny } = localityPrices(file, localityKey);
  for (const row of file.rows) if (row.m === "" && row.d) names.set(row.c.toUpperCase(), row.d);
  return {
    key: localityKey,
    rates: fromFile(rates, { mppr, notOffice }),
    mppr,
    notOffice,
    names,
    release: national.release,
    scope: `${localityName(place)}, MAC ${place.mac}, locality ${place.number}, non-facility, 2026`,
    localities: ny.map((item) => ({ key: keyOf(item), label: `${localityName(item)} (${keyOf(item)})` })),
  };
}

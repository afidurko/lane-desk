import { createServerFn } from "@tanstack/react-start";
import { allowedPage, codesInLinks, exactPhrase, HUBS, hubLinks, pagesFor, readListing, type CrawlAsk } from "@/lib/lookup/crawl";
import { fileHint } from "@/lib/lookup/place";

export type CrawlHit = {
  code: string;
  phrase: string;
  host: string;
  url: string;
  found: boolean;
  quote: string | null;
  pageCents: number | null;
  note: string;
  related: string[];
  file: string | null;
};

export const findPhrases = createServerFn({ method: "POST" })
  .inputValidator((input: { asks: CrawlAsk[]; hubs?: boolean }) => {
    const asks = Array.isArray(input?.asks) ? input.asks.slice(0, 8) : [];
    return {
      hubs: input?.hubs === true,
      asks: asks.flatMap((ask) => {
        const year = typeof ask?.year === "number" && Number.isFinite(ask.year) ? ask.year : null;
        const phrase = exactPhrase({ code: String(ask?.code ?? ""), year });
        return phrase ? [{ code: String(ask.code).trim().toUpperCase(), year }] : [];
      }),
    };
  })
  .handler(async ({ data }): Promise<CrawlHit[]> => {
    const groups = await Promise.all(data.asks.map((ask) => crawlAsk(ask)));
    const hubs = data.hubs
      ? await Promise.race([
          spiderHubs(data.asks),
          new Promise<CrawlHit[]>((resolve) => setTimeout(() => resolve([]), 5000)),
        ])
      : [];
    return [...groups.flat(), ...hubs];
  });

async function crawlAsk(ask: CrawlAsk): Promise<CrawlHit[]> {
  const phrase = exactPhrase(ask);
  if (!phrase) return [];
  const pages = pagesFor(ask);
  const loaded = await Promise.all(pages.map((page) => fetchPage(page.url, ask.code)));
  return pages.map((page, index) => {
    const read = loaded[index];
    const related = [...new Set([...read.related, ...codesInLinks(read.html).filter((code) => code !== ask.code)])].slice(0, 8);
    return { code: ask.code, phrase, host: page.host, url: page.url, found: read.found, quote: read.quote, pageCents: read.pageCents, note: read.note ?? "The page did not answer.", related, file: read.found ? read.file ?? fileHint(page.url) : null };
  });
}

async function spiderHubs(asks: CrawlAsk[]): Promise<CrawlHit[]> {
  const named = HUBS.filter((hub) => fileHint(hub.url));
  const pages = await Promise.all(named.map(async (hub) => ({ hub, loaded: await fetchPage(hub.url, "A0428") })));
  const links = pages.flatMap((page) => hubLinks(page.loaded.html, page.hub.url)).slice(0, 4);
  const next = await Promise.all(links.map(async (link) => ({ link, loaded: await fetchPage(link.url, "A0428") })));
  const discovered = [...new Set([...pages, ...next].flatMap((page) => codesInLinks(page.loaded.html)))].slice(0, 8);
  const hits: CrawlHit[] = [];
  for (const ask of asks) {
    const phrase = exactPhrase(ask);
    if (!phrase) continue;
    const fromLinks = discovered.filter((code) => code !== ask.code);
    let namedHit = false;
    for (const item of [...pages, ...next]) {
      const read = readListing(item.loaded.html, ask.code);
      if (!read.found) continue;
      namedHit = true;
      const url = "hub" in item ? item.hub.url : item.link.url;
      const host = "hub" in item ? item.hub.host : item.link.host;
      hits.push({
        code: ask.code,
        phrase,
        host,
        url,
        found: true,
        quote: read.quote,
        pageCents: read.pageCents,
        note: read.note ?? "The page names the code.",
        related: [...new Set([...read.related, ...fromLinks])].slice(0, 8),
        file: read.file ?? fileHint(url),
      });
    }
    if (!namedHit && fromLinks.length > 0) {
      hits.push({ code: ask.code, phrase, host: "CMS", url: HUBS[0].url, found: false, quote: null, pageCents: null, note: "A public link names other codes. Those are looked up next.", related: fromLinks, file: null });
    }
  }
  return hits;
}

async function fetchPage(url: string, code: string) {
  if (!allowedPage(url)) return { found: false, quote: null, pageCents: null, note: "That page is not a public fee page.", related: [] as string[], file: null, html: "" };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "text/html, application/json" } });
    if (!response.ok) return { found: false, quote: null, pageCents: null, note: "That page did not answer.", related: [] as string[], file: null, html: "" };
    const html = await response.text();
    return { ...readListing(html, code), html };
  } catch {
    return { found: false, quote: null, pageCents: null, note: "That page did not answer.", related: [] as string[], file: null, html: "" };
  }
}

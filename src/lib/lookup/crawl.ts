import { fileHint } from "@/lib/lookup/place";

const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;

/** These stay on the posted file. A page does not replace them. */
export const SEEDED = ["E0431", "99213", "99214", "97110", "97161", "A0428", "A0425"] as const;

/** Public pages the spider always starts from. Each one answered. */
export const HUBS = [
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-schedules" },
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-schedules/physician" },
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-schedules/dmepos" },
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-schedules/dmepos/dmepos-fee-schedule" },
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-schedules/ambulance" },
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory-fee-schedule-clfs" },
  { host: "CMS", url: "https://www.cms.gov/medicare/payment/fee-for-service-providers/part-b-drugs/average-drug-sales-price" },
  { host: "CMS", url: "https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update" },
  { host: "CMS", url: "https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-coding-system-hcpcs/hcpcs-level-ii-archive" },
  { host: "CMS data", url: "https://data.cms.gov/provider-summary-by-type-of-service" },
] as const;

export function seeded(code: string) {
  return (SEEDED as readonly string[]).includes(code.trim().toUpperCase());
}

export const PUBLIC_HOSTS = [
  "https://www.cms.gov/",
  "https://www.health.ny.gov/",
  "https://data.cms.gov/",
  "https://clinicaltables.nlm.nih.gov/",
];

export type CrawlAsk = { code: string; year: number | null };

export type PageRead = {
  found: boolean;
  quote: string | null;
  pageCents: number | null;
  note: string | null;
  related: string[];
  file: string | null;
};

/** The exact phrase for one code. The year is included only when the line has one. */
export function exactPhrase(ask: CrawlAsk) {
  const code = ask.code.trim().toUpperCase();
  if (!CODE.test(code)) return null;
  return ask.year ? `"${code}" ${ask.year}` : `"${code}"`;
}

export function allowedPage(url: string) {
  return PUBLIC_HOSTS.some((host) => url.startsWith(host));
}

export function pagesFor(ask: CrawlAsk) {
  const phrase = exactPhrase(ask);
  if (!phrase) return [];
  const code = ask.code.trim().toUpperCase();
  const query = encodeURIComponent(phrase);
  return [
    { host: "Code list", url: `https://clinicaltables.nlm.nih.gov/api/hcpcs/v3/search?terms=${encodeURIComponent(code)}` },
    { host: "CMS", url: `https://www.cms.gov/search?keys=${query}` },
    { host: "New York", url: `https://www.health.ny.gov/search/?q=${query}` },
  ];
}

/** Every full code on the sheet. Unknowns go first. There is no cap. */
export function asksFrom(lines: { code: string; year: number | null; unknown: boolean }[]) {
  const ranked = [...lines].sort((a, b) => Number(b.unknown) - Number(a.unknown));
  const seen = new Set<string>();
  const asks: CrawlAsk[] = [];
  for (const line of ranked) {
    const code = line.code.trim().toUpperCase();
    const key = `${code}:${line.year ?? ""}`;
    if (!CODE.test(code) || seen.has(key)) continue;
    seen.add(key);
    asks.push({ code, year: line.year });
  }
  for (const code of SEEDED) {
    if (seen.has(`${code}:`)) continue;
    if ([...seen].some((key) => key.startsWith(`${code}:`))) continue;
    seen.add(`${code}:`);
    asks.push({ code, year: null });
  }
  return asks;
}

/** A public link whose address or label contains the exact code. Other sites are not followed. */
export function linkedPages(html: string, code: string, from: string) {
  const wanted = code.trim().toUpperCase();
  if (!CODE.test(wanted)) return [];
  const origin = originOf(from);
  const found: { host: string; url: string }[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absoluteUrl(match[1], origin);
    const label = match[2].replace(/<[^>]+>/g, " ");
    if (!url || !allowedPage(url) || !`${url} ${label}`.toUpperCase().includes(wanted)) continue;
    if (found.some((page) => page.url === url)) continue;
    found.push({ host: hostOf(url), url });
    if (found.length === 4) break;
  }
  return found;
}

/** Links from a hardcoded public page. Zip files and other sites are left alone. */
export function hubLinks(html: string, from: string) {
  const origin = originOf(from);
  const found: { host: string; url: string }[] = [];
  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    const url = absoluteUrl(match[1], origin);
    if (!url || !allowedPage(url) || /\.(zip|pdf)(\?|$)/i.test(url)) continue;
    if (!/fee|hcpcs|schedule|coding|payment|rates/i.test(url)) continue;
    if (found.some((page) => page.url === url)) continue;
    found.push({ host: hostOf(url), url });
    if (found.length === 4) break;
  }
  return found;
}

export function codesNear(text: string, code: string) {
  const wanted = code.trim().toUpperCase();
  const found = text.toUpperCase().match(/\b(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})\b/g) ?? [];
  return [...new Set(found.filter((item) => item !== wanted && CODE.test(item)))].slice(0, 4);
}

/** Codes written in a public link's address or label. The page text is not required. */
export function codesInLinks(html: string) {
  const found: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const blob = `${match[1]} ${match[2].replace(/<[^>]+>/g, " ")}`.toUpperCase();
    for (const code of blob.match(/\b(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})\b/g) ?? []) {
      if (!CODE.test(code) || found.includes(code)) continue;
      found.push(code);
      if (found.length === 8) return found;
    }
  }
  return found;
}

export function readListing(body: string, code: string): PageRead {
  const trimmed = body.trim();
  if (trimmed.startsWith("[")) {
    try {
      return readCodeList(JSON.parse(trimmed) as unknown, code);
    } catch {
      return readPage(body, code);
    }
  }
  return readPage(body, code);
}

function readCodeList(parsed: unknown, code: string): PageRead {
  const wanted = code.trim().toUpperCase();
  const rows = Array.isArray(parsed) ? parsed[3] : null;
  if (!Array.isArray(rows)) return empty("The code list did not name it.");
  const hit = rows.find((row) => Array.isArray(row) && String(row[0]).toUpperCase() === wanted);
  if (!hit) return empty("The exact code was not on that list.");
  const name = String(hit[1] ?? "").trim();
  return { found: true, quote: name ? `${wanted} ${name}` : wanted, pageCents: null, related: [], file: null, note: noteFor(wanted, "The public code list names this. It has no fee, so none was used.") };
}

/** Read one public page. A dollar next to the exact code is reported and not chosen as the payment. */
export function readPage(html: string, code: string): PageRead {
  const wanted = code.trim().toUpperCase();
  if (!CODE.test(wanted)) return empty("That is not a full code.");
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/\s+/g, " ");
  const at = text.toUpperCase().search(new RegExp(`\\b${wanted}\\b`));
  if (at < 0) return empty("The exact phrase was not on that page.");
  const quote = text.slice(Math.max(0, at - 70), at + wanted.length + 70).trim();
  const window = text.slice(Math.max(0, at - 80), at + wanted.length + 80);
  const related = [...new Set([...codesNear(window, wanted), ...codesInLinks(html).filter((code) => code !== wanted)])].slice(0, 8);
  const file = fileHint(text.slice(Math.max(0, at - 200), at + wanted.length + 200));
  const amounts = [...window.matchAll(/\$?\s*(\d{1,4}\.\d{2})/g)].map((item) => Math.round(Number(item[1]) * 100));
  const unique = [...new Set(amounts)];
  if (unique.length === 1) return { found: true, quote, pageCents: unique[0], related, file, note: noteFor(wanted, "A page shows this amount next to the code. It was not used as the payment.") };
  if (unique.length > 1) return { found: true, quote, pageCents: null, related, file, note: noteFor(wanted, "More than one amount was next to the code. None was used.") };
  return { found: true, quote, pageCents: null, related, file, note: noteFor(wanted, "The page names the code. It has no single amount, so none was used.") };
}

function empty(note: string): PageRead {
  return { found: false, quote: null, pageCents: null, note, related: [], file: null };
}

function noteFor(code: string, note: string) {
  return seeded(code) ? `${note} This code stays on the posted file.` : note;
}

function originOf(from: string) {
  try {
    return new URL(from).origin;
  } catch {
    return "";
  }
}

function absoluteUrl(href: string, origin: string) {
  if (href.startsWith("https://")) return href;
  if (href.startsWith("/") && origin) return `${origin}${href}`;
  return "";
}

function hostOf(url: string) {
  if (url.startsWith("https://clinicaltables.nlm.nih.gov/")) return "Code list";
  if (url.startsWith("https://www.health.ny.gov/")) return "New York";
  if (url.startsWith("https://data.cms.gov/")) return "CMS data";
  return "CMS";
}

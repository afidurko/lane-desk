import { readInvoiceLines, type CheckLine } from "@/lib/lookup/check";
import { emlParts, imageText, jsonText, odsText, spreadsheetXml } from "@/lib/lookup/more-files";
import { oleText } from "@/lib/lookup/ole";
import { pdfText } from "@/lib/lookup/pdf-text";
import { unzipArchive, workbookText } from "@/lib/lookup/xlsx-read";

const FILE_LIMIT = 8_000_000;

export function decodeImport(bytes: Uint8Array) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

export async function readImportFile(file: File): Promise<{ text: string } | { error: string }> {
  if (file.size > FILE_LIMIT) return { error: "That file is over 8 MB. Export a smaller invoice." };
  return readImportBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}

export async function readImportBytes(name: string, bytes: Uint8Array): Promise<{ text: string } | { error: string }> {
  if (bytes.length > FILE_LIMIT) return { error: "That file is over 8 MB. Export a smaller invoice." };
  try {
    const text = await textFromFile(name, bytes, 0);
    if (!text.trim()) return { error: emptyReason(name, bytes) };
    return { text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("This PDF")) return { error: message };
    if (isPicture(name, bytes)) return { error: "That picture has no text stored in the file. The writing on a photo was not read, and no amount was guessed." };
    if (isOle(bytes)) return { error: "That older file had no code in it. No amount was guessed." };
    return { error: "That file could not be read. No amount was guessed." };
  }
}

async function textFromFile(name: string, bytes: Uint8Array, depth: number): Promise<string> {
  if (depth > 3) return "";
  if (isPicture(name, bytes)) {
    const embedded = imageText(bytes);
    if (embedded.trim()) return embedded;
    if (depth > 0) return "";
    throw new Error("picture");
  }
  if (isOle(bytes)) return oleText(bytes);
  if (isPdf(bytes)) return pdfText(bytes);
  if (isZip(bytes)) return zipText(name, bytes, depth);
  const text = decodeImport(bytes).replace(/^\uFEFF/, "");
  if (text.trimStart().startsWith("{\\rtf")) return rtfText(text);
  if (/Workbook[\s\S]{0,400}<Worksheet/i.test(text) && /<Row\b/i.test(text)) return spreadsheetXml(text);
  if (/<table:table-row\b/.test(text)) return odsText(text);
  if (text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
    const json = jsonText(text);
    if (json.trim()) return json;
  }
  if (/^[\s\S]{0,2000}content-type:/i.test(text) && /boundary=|content-transfer-encoding:/i.test(text)) return messageText(text, depth);
  if (/^\s*</.test(text) && /<\/?[a-z]/i.test(text)) return htmlText(text);
  return text;
}

async function zipText(name: string, bytes: Uint8Array, depth: number) {
  const files = await unzipArchive(bytes);
  if (files.has("xl/workbook.xml") || [...files.keys()].some((item) => item.startsWith("xl/worksheets/"))) return workbookText(bytes);
  const document = files.get("word/document.xml");
  if (document) return docxText(new TextDecoder().decode(document));
  const content = files.get("content.xml");
  const kind = files.get("mimetype");
  if (content && (name.toLowerCase().endsWith(".ods") || (kind && new TextDecoder().decode(kind).includes("opendocument.spreadsheet")) || new TextDecoder().decode(content).includes("office:spreadsheet"))) {
    return odsText(new TextDecoder().decode(content));
  }
  const parts: string[] = [];
  let count = 0;
  for (const [path, data] of files) {
    if (count >= 40 || path.endsWith("/") || path.includes("__MACOSX") || path.startsWith("xl/") || path.startsWith("word/") || path === "mimetype") continue;
    count += 1;
    const piece = await textFromFile(path.split("/").pop() ?? path, data, depth + 1);
    if (piece.trim()) parts.push(piece);
  }
  return parts.join("\n");
}

async function messageText(raw: string, depth: number) {
  const parts: string[] = [];
  for (const part of emlParts(raw)) {
    const piece = await textFromFile(part.name, part.bytes, depth + 1);
    if (piece.trim()) parts.push(piece);
  }
  return parts.join("\n");
}

function emptyReason(name: string, bytes: Uint8Array) {
  if (isPicture(name, bytes)) return "That picture has no text stored in the file. The writing on a photo was not read, and no amount was guessed.";
  if (isPdf(bytes)) return "This PDF has no text. A scanned page was not read, and no amount was guessed.";
  if (isOle(bytes)) return "That older file had no code in it. No amount was guessed.";
  return "That file was empty.";
}

export function docxText(xml: string) {
  return decodeEntities(xml.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")).trim();
}

export function rtfText(raw: string) {
  return raw
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, (item) => String.fromCharCode(Number.parseInt(item.slice(2), 16)))
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .trim();
}

export function htmlText(raw: string) {
  return decodeEntities(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/t[dh]>/gi, "\t")
      .replace(/<[^>]+>/g, " "),
  ).trim();
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { lt: "<", gt: ">", quot: "\"", apos: "'", amp: "&", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : whole;
    }
    return named[body.toLowerCase()] ?? whole;
  });
}

function isZip(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isPdf(bytes: Uint8Array) {
  return latin1(bytes.subarray(0, 5)) === "%PDF-";
}

function isOle(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

function isPicture(name: string, bytes: Uint8Array) {
  if (/\.(png|jpe?g|gif|webp|heic|tif|tiff|bmp)$/i.test(name)) return true;
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function latin1(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

/** The lines the check can keep. An NPI, a phone, and an email are left out. */
export function prepareInvoice(raw: string) {
  const lines = readInvoiceLines(raw);
  if (lines.length === 0) return "";
  return lines.map(formatLine).join("\n");
}

function formatLine(line: CheckLine) {
  const parts = [line.modifier ? `${line.code}-${line.modifier}` : line.code];
  if (line.date) parts.push(line.date);
  if (line.units !== null) parts.push(`${trimUnits(line.units)} units`);
  if (line.setting === "nf") parts.push("office");
  if (line.setting === "fac") parts.push("facility");
  if (line.payer) parts.push(line.payer);
  if (line.schedule) parts.push(`schedule ${line.schedule}`);
  if (line.lookupCents) parts.push(`lookup ${(line.lookupCents / 100).toFixed(2)}`);
  if (line.billedCents !== null) parts.push(`charge ${(line.billedCents / 100).toFixed(2)}`);
  if (line.paidCents !== null && line.paidKind) parts.push(`${line.paidKind} ${(line.paidCents / 100).toFixed(2)}`);
  if (line.adminCents) parts.push(`admin ${(line.adminCents / 100).toFixed(2)}`);
  if (line.seqRate) parts.push(`seq ${line.seqRate.toFixed(2)}`);
  if (line.seqPayCents) parts.push(`seqpay ${(line.seqPayCents / 100).toFixed(2)}`);
  return parts.join(" ");
}

function trimUnits(units: number) {
  return String(Math.round(units * 1000) / 1000);
}
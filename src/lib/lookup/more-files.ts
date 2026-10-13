import { sheetToInvoice } from "@/lib/lookup/xlsx-read";

export function odsText(xml: string) {
  const grid: string[][] = [];
  for (const row of xml.split(/<table:table-row\b/).slice(1)) {
    const cells: string[] = [];
    for (const cell of row.matchAll(/<table:table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? "";
      const repeat = Math.min(200, Number(/table:number-columns-repeated="(\d+)"/.exec(attrs)?.[1] ?? 1) || 1);
      const text = [...body.matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g)].map((item) => decodeXml(item[1].replace(/<[^>]+>/g, ""))).join(" ");
      const value = decodeXml(/office:value="([^"]*)"/.exec(attrs)?.[1] ?? "");
      const shown = text || value;
      if (repeat > 1 && !shown) {
        cells.push("");
        continue;
      }
      for (let index = 0; index < repeat; index += 1) cells.push(shown);
    }
    if (cells.some((item) => item.trim())) grid.push(cells);
  }
  return sheetToInvoice(grid);
}

export function spreadsheetXml(xml: string) {
  const grid: string[][] = [];
  for (const row of xml.split(/<Row\b/).slice(1)) {
    const cells: string[] = [];
    for (const cell of row.matchAll(/<Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Cell>)/g)) {
      const index = Number(/ss:Index="(\d+)"/.exec(cell[1])?.[1] ?? 0);
      if (index > 0) while (cells.length < index - 1) cells.push("");
      const data = /<Data\b[^>]*>([\s\S]*?)<\/Data>/.exec(cell[2] ?? "")?.[1] ?? "";
      cells.push(decodeXml(data.replace(/<[^>]+>/g, "")));
    }
    if (cells.some((item) => item.trim())) grid.push(cells);
  }
  return sheetToInvoice(grid);
}

export function jsonText(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const rows = tabular(parsed);
    if (!rows) return "";
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const grid = [keys, ...rows.map((row) => keys.map((key) => cell(row[key])))];
    return sheetToInvoice(grid);
  } catch {
    return "";
  }
}

export function emlParts(raw: string) {
  const split = raw.split(/\r?\n\r?\n/);
  const header = split[0] ?? "";
  const body = split.slice(1).join("\n\n");
  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(header)?.[1];
  if (!boundary) return [{ name: "message.txt", bytes: textBytes(decodeBody(header, body)) }];
  const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (const part of parts) {
    if (!part.trim() || part.trim() === "--") continue;
    const pair = part.replace(/^\r?\n/, "").split(/\r?\n\r?\n/);
    const partHeader = pair[0] ?? "";
    const partBody = pair.slice(1).join("\n\n").replace(/\r?\n--$/, "");
    const name = /filename="?([^";\r\n]+)"?/i.exec(partHeader)?.[1] ?? "part.txt";
    files.push({ name, bytes: bytesOf(partHeader, partBody) });
  }
  return files;
}

export function imageText(bytes: Uint8Array) {
  const png = pngText(bytes);
  if (png.trim()) return png;
  return jpegComment(bytes);
}

function tabular(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value) && value.every((row) => row && typeof row === "object" && !Array.isArray(row))) return value as Record<string, unknown>[];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["lines", "rows", "claims", "data", "items"]) {
    const nested = tabular(record[key]);
    if (nested) return nested;
  }
  return [record];
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function decodeBody(header: string, body: string) {
  const encoding = /content-transfer-encoding:\s*([^\r\n]+)/i.exec(header)?.[1]?.toLowerCase() ?? "";
  if (encoding.includes("base64")) return textFromBytes(base64(body));
  if (encoding.includes("quoted-printable")) return quoted(body);
  return body;
}

function bytesOf(header: string, body: string) {
  const encoding = /content-transfer-encoding:\s*([^\r\n]+)/i.exec(header)?.[1]?.toLowerCase() ?? "";
  if (encoding.includes("base64")) return base64(body);
  if (encoding.includes("quoted-printable")) return textBytes(quoted(body));
  return textBytes(body);
}

function base64(raw: string) {
  const clean = raw.replace(/[^A-Za-z0-9+/=]/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function quoted(raw: string) {
  return raw
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function textBytes(text: string) {
  return new TextEncoder().encode(text);
}

function textFromBytes(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function pngText(bytes: Uint8Array) {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: string[] = [];
  for (let index = 8; index + 12 <= bytes.length; ) {
    const length = view.getUint32(index, false);
    const type = latin1(bytes.subarray(index + 4, index + 8));
    const data = bytes.subarray(index + 8, index + 8 + length);
    if (type === "tEXt" || type === "iTXt") {
      const text = latin1(data);
      const cut = text.indexOf("\0");
      parts.push(cut >= 0 ? text.slice(cut + 1) : text);
    }
    index += 12 + length;
    if (type === "IEND" || length > bytes.length) break;
  }
  return parts.join("\n");
}

function jpegComment(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: string[] = [];
  for (let index = 2; index + 4 < bytes.length; ) {
    if (bytes[index] !== 0xff) break;
    const marker = bytes[index + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(index + 2, false);
    if (marker === 0xfe) parts.push(latin1(bytes.subarray(index + 4, index + 2 + length)));
    index += 2 + length;
  }
  return parts.join("\n");
}

function decodeXml(value: string) {
  const named: Record<string, string> = { lt: "<", gt: ">", quot: "\"", apos: "'", amp: "&", nbsp: " " };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : whole;
    }
    return named[body.toLowerCase()] ?? whole;
  });
}

function latin1(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

import { scheduleOf } from "@/lib/lookup/schedule-price";

const CODE = /^(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})$/;

export async function workbookText(bytes: Uint8Array) {
  const grid = await firstSheet(bytes);
  return sheetToInvoice(grid);
}

export function sheetToInvoice(grid: string[][]) {
  const band = grid.findIndex((row, index) => index < 40 && row.some((cell) => cell.trim().toUpperCase() === "CPT" || cell.trim().toUpperCase() === "HCPCS"));
  if (band < 0) return grid.map((row) => row.join("\t")).filter((row) => row.trim()).join("\n");
  const width = Math.max(...grid.slice(band, band + 3).map((row) => row.length), 0);
  const labels = Array.from({ length: width }, (_, column) =>
    [0, 1, 2].map((offset) => (grid[band + offset]?.[column] ?? "").trim()).filter(Boolean).join(" ").toLowerCase(),
  );
  const codeCol = labels.findIndex((label) => /cpt|hcpcs/.test(label) && /\bcode\b/.test(label) && !/lookup/.test(label));
  if (codeCol < 0) return grid.map((row) => row.join("\t")).filter((row) => row.trim()).join("\n");
  const dateCol = labels.findIndex((label) => /\bdate\b/.test(label));
  const modifierCol = labels.findIndex((label) => /\bmodifier\b/.test(label));
  const unitCol = labels.findIndex((label) => /\bunits?\b/.test(label));
  const billedUnit = labels.findIndex((label) => /provider/.test(label) && /billed/.test(label));
  const billedGross = billedUnit >= 0 && /gross/.test(labels[billedUnit + 1] ?? "") ? billedUnit + 1 : -1;
  const chargeCol = billedGross >= 0 ? billedGross : billedUnit;
  const paidCol = labels.findIndex((label) => /i want/.test(label) && /pay/.test(label));
  const scheduleCol = labels.findIndex((label) => /schdule|schedule/.test(label));
  const lookupCol = labels.findIndex((label) => /\blookup\b/.test(label));
  const competitorCol = labels.findIndex((label) => /collabrios|competitor/.test(label));
  const dataStart = band + 3;
  const seqCol = rateColumn(grid, dataStart);
  const settingCol = findSetting(grid, dataStart);
  const claimCol = findClaim(grid, dataStart);
  const lines: string[] = [];
  const short: string[] = [];
  for (const row of grid.slice(dataStart)) {
    const rawCode = (row[codeCol] ?? "").trim();
    const code = rawCode.toUpperCase();
    if (!rawCode || /^(CPT|CODE|HCPCS)$/i.test(rawCode)) continue;
    if (!CODE.test(code)) {
      short.push(rawCode);
      continue;
    }
    const modifier = modifierCol >= 0 ? (row[modifierCol] ?? "").trim().toUpperCase() : "";
    const parts = [CODE.test(code) && /^[A-Z0-9]{2}$/.test(modifier) ? `${code}-${modifier}` : code];
    const date = dateCol >= 0 ? asDate(row[dateCol] ?? "") : "";
    if (date) parts.push(date);
    const units = unitCol >= 0 ? wholeUnits(row[unitCol] ?? "") : null;
    if (units !== null) parts.push(`${units} units`);
    const setting = settingCol >= 0 ? (row[settingCol] ?? "").trim().toUpperCase() : "";
    if (setting === "NON FACILITY") parts.push("office");
    if (setting === "FACILITY") parts.push("facility");
    const claim = claimCol >= 0 ? (row[claimCol] ?? "").trim() : "";
    if (/^institutional$/i.test(claim)) parts.push("institutional");
    else if (/^professional$/i.test(claim)) parts.push("professional");
    else if (/other paper/i.test(claim)) parts.push("other paper");
    if (scheduleCol >= 0) parts.push(`schedule ${scheduleOf(row[scheduleCol] ?? "")}`);
    const lookup = lookupCol >= 0 ? cents(row[lookupCol] ?? "") : null;
    if (lookup) parts.push(`lookup ${(lookup / 100).toFixed(2)}`);
    const charge = chargeCol >= 0 ? cents(row[chargeCol] ?? "") : null;
    if (charge !== null && charge !== 0) parts.push(`charge ${(charge / 100).toFixed(2)}`);
    const paid = paidCol >= 0 ? cents(row[paidCol] ?? "") : null;
    const scaled = lookup && units ? Math.round(lookup * units) : lookup;
    if (paid && (scaled === null || Math.abs(paid - scaled) > 1)) parts.push(`paid ${(paid / 100).toFixed(2)}`);
    const admin = competitorCol >= 0 ? cents(row[competitorCol] ?? "") : null;
    if (admin) parts.push(`admin ${(admin / 100).toFixed(2)}`);
    else if (admin === 0 && lookup) parts.push("admin 0.00");
    if (seqCol >= 0 && Math.abs(Number(row[seqCol] ?? "") - 0.98) < 0.001) {
      parts.push("seq 0.98");
      const reduced = cents(row[seqCol + 1] ?? "");
      if (reduced) parts.push(`seqpay ${(reduced / 100).toFixed(2)}`);
    }
    lines.push(parts.join(" "));
  }
  return [lines.join("\n"), ...short.map((code) => `SHORT ${code}`)].filter(Boolean).join("\n");
}

async function firstSheet(bytes: Uint8Array) {
  const files = await unzipArchive(bytes);
  const shared = files.get("xl/sharedStrings.xml");
  const strings = shared ? sharedStrings(new TextDecoder().decode(shared)) : [];
  const name = [...files.keys()].find((item) => /^xl\/worksheets\/sheet\d+\.xml$/.test(item));
  if (!name) throw new Error("The workbook has no sheet.");
  return sheetGrid(new TextDecoder().decode(files.get(name) ?? new Uint8Array()), strings);
}

function sharedStrings(xml: string) {
  return xml.split(/<si\b/).slice(1).map((block) =>
    [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXml(item[1])).join(""),
  );
}

function sheetGrid(xml: string, strings: string[]) {
  const grid: string[][] = [];
  for (const block of xml.split(/<row\b/).slice(1)) {
    const number = Number(/\br="(\d+)"/.exec(block)?.[1] ?? 0);
    if (!number) continue;
    const cells: string[] = [];
    for (const cell of block.matchAll(/<c\b([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const column = colIndex(/\br="([A-Z]+)/.exec(cell[1])?.[1] ?? "");
      while (cells.length < column) cells.push("");
      const type = /\bt="([^"]*)"/.exec(cell[1])?.[1] ?? "";
      const body = cell[2] ?? "";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      const text = type === "s" ? strings[Number(raw)] ?? "" : type === "inlineStr" ? [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => decodeXml(item[1])).join("") : raw;
      cells[column] = decodeXml(text);
    }
    grid[number - 1] = cells;
  }
  for (let index = 0; index < grid.length; index += 1) grid[index] ??= [];
  return grid;
}

function findSetting(grid: string[][], start: number) {
  const width = Math.max(...grid.slice(start, start + 40).map((row) => row.length), 0);
  let best = -1;
  let score = 0;
  for (let column = 0; column < width; column += 1) {
    let count = 0;
    for (const row of grid.slice(start, start + 40)) {
      if (/^(NON\s+)?FACILITY$/i.test((row[column] ?? "").trim())) count += 1;
    }
    if (count > score) {
      score = count;
      best = column;
    }
  }
  return score >= 3 ? best : -1;
}

function findClaim(grid: string[][], start: number) {
  const width = Math.max(...grid.slice(start, start + 40).map((row) => row.length), 0);
  let best = -1;
  let score = 0;
  for (let column = 0; column < width; column += 1) {
    let count = 0;
    for (const row of grid.slice(start, start + 40)) {
      if (/^(professional|institutional|other paper invoice)$/i.test((row[column] ?? "").trim())) count += 1;
    }
    if (count > score) {
      score = count;
      best = column;
    }
  }
  return score >= 3 ? best : -1;
}

function wholeUnits(raw: string) {
  const cleaned = raw.trim();
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(cleaned)) return null;
  const units = Number(cleaned);
  return Number.isFinite(units) && units >= 0 && units <= 999 ? units : null;
}

function rateColumn(grid: string[][], start: number) {
  const width = Math.max(...grid.slice(start, start + 80).map((row) => row.length), 0);
  let best = -1;
  let hits = 0;
  for (let column = 0; column < width; column += 1) {
    let count = 0;
    for (const row of grid.slice(start)) {
      if (Math.abs(Number(row[column] ?? "") - 0.98) < 0.001) count += 1;
    }
    if (count > hits) {
      hits = count;
      best = column;
    }
  }
  return hits >= 3 ? best : -1;
}

function cents(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function asDate(raw: string) {
  const text = raw.trim();
  if (!/^\d{5}(\.\d+)?$/.test(text)) return text;
  const serial = Math.round(Number(text));
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  const year = date.getUTCFullYear();
  if (year < 1990 || year > 2100) return text;
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function colIndex(letters: string) {
  let number = 0;
  for (const char of letters) number = number * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, number - 1);
}

function decodeXml(value: string) {
  const named: Record<string, string> = { lt: "<", gt: ">", quot: "\"", apos: "'", amp: "&" };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : whole;
    }
    return named[body.toLowerCase()] ?? whole;
  });
}

export async function unzipArchive(input: Uint8Array) {
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 22 - 65535); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("That file could not be read.");
  const count = view.getUint16(end + 10, true);
  let pointer = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const size = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const local = view.getUint32(pointer + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const compressed = bytes.subarray(dataStart, dataStart + size);
    files.set(name, method === 0 ? compressed : await inflate(compressed));
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function inflate(compressed: Uint8Array) {
  const copy = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

import { sheetToInvoice } from "@/lib/lookup/xlsx-read";

const ENDOFCHAIN = 0xfffffffe;
const FREE = 0xffffffff;

/** Older Excel and Word files. A code is kept only when it is written in the file. */
export function oleText(bytes: Uint8Array) {
  try {
    const streams = compoundStreams(bytes);
    const book = streams.get("Workbook") ?? streams.get("Book");
    if (book) {
      const text = sheetToInvoice(biffGrid(book));
      if (useful(text)) return text;
    }
    const word = streams.get("WordDocument") ?? streams.get("1Table");
    const pulled = visibleText(word ?? bytes);
    return useful(pulled) ? pulled : "";
  } catch {
    const pulled = visibleText(bytes);
    return useful(pulled) ? pulled : "";
  }
}

export function biffGrid(stream: Uint8Array) {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const records: { op: number; data: Uint8Array }[] = [];
  for (let index = 0; index + 4 <= stream.length; ) {
    const op = view.getUint16(index, true);
    const length = view.getUint16(index + 2, true);
    if (index + 4 + length > stream.length) break;
    const data = stream.subarray(index + 4, index + 4 + length);
    index += 4 + length;
    if (op === 0x003c && records.length > 0) {
      const previous = records[records.length - 1];
      const merged = new Uint8Array(previous.data.length + data.length);
      merged.set(previous.data);
      merged.set(data, previous.data.length);
      previous.data = merged;
    } else {
      records.push({ op, data });
    }
  }
  const strings: string[] = [];
  const cells = new Map<string, string>();
  let rows = 0;
  let cols = 0;
  const put = (row: number, col: number, value: string) => {
    cells.set(`${row}:${col}`, value);
    rows = Math.max(rows, row + 1);
    cols = Math.max(cols, col + 1);
  };
  for (const record of records) {
    const data = new DataView(record.data.buffer, record.data.byteOffset, record.data.byteLength);
    if (record.op === 0x00fc) strings.push(...sharedStrings(record.data));
    if (record.op === 0x00fd && record.data.length >= 10) put(data.getUint16(0, true), data.getUint16(2, true), strings[data.getUint32(6, true)] ?? "");
    if (record.op === 0x0203 && record.data.length >= 14) put(data.getUint16(0, true), data.getUint16(2, true), String(data.getFloat64(6, true)));
    if (record.op === 0x027e && record.data.length >= 10) put(data.getUint16(0, true), data.getUint16(2, true), String(rkValue(data.getUint32(6, true))));
    if (record.op === 0x00bd && record.data.length >= 6) {
      const row = data.getUint16(0, true);
      let col = data.getUint16(2, true);
      for (let offset = 4; offset + 6 <= record.data.length - 2; offset += 6) {
        put(row, col, String(rkValue(data.getUint32(offset + 2, true))));
        col += 1;
      }
    }
  }
  return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => cells.get(`${row}:${col}`) ?? ""));
}

function sharedStrings(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 8) return [];
  let unique = view.getUint32(4, true);
  let pointer = 8;
  const strings: string[] = [];
  while (unique > 0 && pointer + 3 <= data.length) {
    const count = view.getUint16(pointer, true);
    const flags = data[pointer + 2];
    pointer += 3;
    let runs = 0;
    let extra = 0;
    if (flags & 0x08) {
      if (pointer + 2 > data.length) break;
      runs = view.getUint16(pointer, true);
      pointer += 2;
    }
    if (flags & 0x04) {
      if (pointer + 4 > data.length) break;
      extra = view.getUint32(pointer, true);
      pointer += 4;
    }
    let text = "";
    if (flags & 0x01) {
      for (let index = 0; index < count && pointer + 1 < data.length; index += 1) {
        text += String.fromCharCode(view.getUint16(pointer, true));
        pointer += 2;
      }
    } else {
      for (let index = 0; index < count && pointer < data.length; index += 1) {
        text += String.fromCharCode(data[pointer]);
        pointer += 1;
      }
    }
    pointer += runs * 4 + extra;
    strings.push(text);
    unique -= 1;
  }
  return strings;
}

function rkValue(rk: number) {
  const divided = rk & 1;
  const number = rk & 2 ? rk >> 2 : float30(rk & 0xfffffffc);
  return divided ? number / 100 : number;
}

function float30(high: number) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setUint32(4, high, true);
  return new DataView(buffer).getFloat64(0, true);
}

function compoundStreams(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 512 || view.getUint32(0, true) !== 0xe011cfd0) throw new Error("not a compound file");
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const cutoff = view.getUint32(0x38, true);
  const fat = fatTable(bytes, view, sectorSize);
  const directory = readChain(bytes, fat, view.getUint32(0x30, true), sectorSize, sectorSize * 64);
  const root = directory.subarray(0, 128);
  const rootStart = new DataView(root.buffer, root.byteOffset, root.byteLength).getUint32(0x74, true);
  const rootSize = new DataView(root.buffer, root.byteOffset, root.byteLength).getUint32(0x78, true);
  const mini = cutoff > 0 ? readChain(bytes, fat, rootStart, sectorSize, rootSize) : new Uint8Array();
  const miniFat = miniFatTable(bytes, view, fat, sectorSize);
  const streams = new Map<string, Uint8Array>();
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const entry = directory.subarray(offset, offset + 128);
    const entryView = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
    const kind = entry[0x42];
    if (kind !== 2) continue;
    const name = utf16(entry.subarray(0, Math.max(0, entryView.getUint16(0x40, true) - 2)));
    const start = entryView.getUint32(0x74, true);
    const size = entryView.getUint32(0x78, true);
    const data = size < cutoff ? readChain(mini, miniFat, start, 64, size) : readChain(bytes, fat, start, sectorSize, size);
    streams.set(name, data);
  }
  return streams;
}

function fatTable(bytes: Uint8Array, view: DataView, sectorSize: number) {
  const sectors: number[] = [];
  for (let index = 0; index < 109; index += 1) {
    const sector = view.getUint32(0x4c + index * 4, true);
    if (sector >= FREE) break;
    sectors.push(sector);
  }
  const fat: number[] = [];
  for (const sector of sectors) {
    const offset = (sector + 1) * sectorSize;
    for (let index = 0; index < sectorSize; index += 4) fat.push(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset + index, true));
  }
  return fat;
}

function miniFatTable(bytes: Uint8Array, view: DataView, fat: number[], sectorSize: number) {
  const count = view.getUint32(0x40, true);
  if (!count) return [];
  const data = readChain(bytes, fat, view.getUint32(0x3c, true), sectorSize, count * sectorSize);
  const table: number[] = [];
  const mini = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let index = 0; index + 4 <= data.length; index += 4) table.push(mini.getUint32(index, true));
  return table;
}

function readChain(bytes: Uint8Array, fat: number[], start: number, sectorSize: number, size: number) {
  const out = new Uint8Array(size);
  let sector = start;
  let at = 0;
  const seen = new Set<number>();
  while (sector < ENDOFCHAIN && at < size && !seen.has(sector)) {
    seen.add(sector);
    const offset = sectorSize === 64 ? sector * 64 : (sector + 1) * sectorSize;
    if (offset < 0 || offset >= bytes.length) break;
    const take = Math.min(sectorSize, size - at, bytes.length - offset);
    out.set(bytes.subarray(offset, offset + take), at);
    at += take;
    sector = fat[sector] ?? ENDOFCHAIN;
  }
  return out;
}

function utf16(bytes: Uint8Array) {
  let text = "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index + 1 < bytes.length; index += 2) text += String.fromCharCode(view.getUint16(index, true));
  return text.replace(/\u0000/g, "");
}

function visibleText(bytes: Uint8Array) {
  const parts: string[] = [];
  let current = "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = view.getUint16(index, true);
    if (code >= 32 && code <= 126) current += String.fromCharCode(code);
    else {
      if (current.length >= 4) parts.push(current);
      current = "";
    }
  }
  if (current.length >= 4) parts.push(current);
  let latin = "";
  for (const byte of bytes) {
    if (byte >= 32 && byte <= 126) latin += String.fromCharCode(byte);
    else {
      if (latin.length >= 8) parts.push(latin);
      latin = "";
    }
  }
  if (latin.length >= 8) parts.push(latin);
  return parts.join("\n");
}

function useful(text: string) {
  return /\b(?:\d{5}|\d{4}[A-Z]|[A-Z]\d{4})\b/.test(text);
}

const STREAM = new TextEncoder().encode("stream");
const END = new TextEncoder().encode("endstream");

export async function pdfText(bytes: Uint8Array) {
  const head = latin1(bytes.subarray(0, Math.min(bytes.length, 200_000)));
  if (head.includes("/Encrypt")) throw new Error("This PDF is locked. It was not read.");
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const at = indexOf(bytes, STREAM, cursor);
    if (at < 0) break;
    let start = at + STREAM.length;
    if (bytes[start] === 0x0d && bytes[start + 1] === 0x0a) start += 2;
    else if (bytes[start] === 0x0a || bytes[start] === 0x0d) start += 1;
    const dict = latin1(bytes.subarray(Math.max(0, at - 400), at));
    const end = indexOf(bytes, END, start);
    if (end < 0) break;
    const length = /\/Length\s+(\d+)/.exec(dict);
    const stop = length ? Math.min(end, start + Number(length[1])) : end;
    cursor = end + END.length;
    if (/\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode/.test(dict)) continue;
    const slice = bytes.subarray(start, stop);
    const raw = /\/FlateDecode/.test(dict) ? await inflate(slice) : slice;
    if (/\/FlateDecode/.test(dict) === false && /\/Filter/.test(dict)) continue;
    parts.push(textFromContent(latin1(raw)));
  }
  return parts.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function textFromContent(content: string) {
  let out = "";
  for (let index = 0; index < content.length; index += 1) {
    if (content.startsWith("T*", index) || content.startsWith("Td", index) || content.startsWith("TD", index)) {
      out += "\n";
      index += 1;
      continue;
    }
    if (content[index] === "<" && content[index + 1] !== "<") {
      const end = content.indexOf(">", index + 1);
      if (end > index && end - index < 400) {
        const decoded = hexText(content.slice(index + 1, end));
        if (decoded) out += decoded;
        index = end;
        continue;
      }
    }
    if (content[index] !== "(") continue;
    const read = readLiteral(content, index);
    out += read.text;
    index = read.next - 1;
  }
  return out;
}

function readLiteral(content: string, start: number) {
  let text = "";
  for (let index = start + 1; index < content.length; index += 1) {
    const char = content[index];
    if (char === "\\") {
      const next = content[index + 1] ?? "";
      if (/[0-7]/.test(next)) {
        const octal = content.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
        text += String.fromCharCode(Number.parseInt(octal, 8));
        index += octal.length;
        continue;
      }
      text += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next;
      index += 1;
      continue;
    }
    if (char === ")") return { text: decodePdfString(text), next: index + 1 };
    text += char;
  }
  return { text: decodePdfString(text), next: content.length };
}

function decodePdfString(text: string) {
  if (text.charCodeAt(0) !== 0xfe || text.charCodeAt(1) !== 0xff) return text;
  let out = "";
  for (let index = 2; index + 1 < text.length; index += 2) out += String.fromCharCode((text.charCodeAt(index) << 8) | text.charCodeAt(index + 1));
  return out;
}

function hexText(raw: string) {
  const clean = raw.replace(/[\s<>]/g, "");
  if (clean.length < 4 || clean.length % 2 !== 0 || /[^0-9A-Fa-f]/.test(clean)) return "";
  let text = "";
  for (let index = 0; index < clean.length; index += 2) text += String.fromCharCode(Number.parseInt(clean.slice(index, index + 2), 16));
  text = decodePdfString(text);
  const printable = [...text].filter((char) => char >= " " && char <= "~").length;
  return printable >= text.length * 0.8 ? text : "";
}

function latin1(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

function indexOf(hay: Uint8Array, needle: Uint8Array, from: number) {
  for (let index = from; index <= hay.length - needle.length; index += 1) {
    let match = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (hay[index + offset] !== needle[offset]) {
        match = false;
        break;
      }
    }
    if (match) return index;
  }
  return -1;
}

async function inflate(compressed: Uint8Array) {
  const copy = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Every CMS short descriptor on the 2026 physician fee schedule RVU files (all releases on this machine: A to D,
 * nonQPP CSVs), lowercased. CPT descriptors are AMA-licensed: none may ship in a public build.
 * Source dir: $CMS_PFS_DIR or /workspace/healthcare-pfs. Returns null when no 2026 RVU file is present (the
 * caller skips cleanly). Nothing here is bundled: this runs only in checks.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function findCsvs(dir, out = [], depth = 0) {
  if (depth > 8 || !existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) findCsvs(full, out, depth + 1);
    else if (/^PPRRVU2026_[A-Za-z]+_nonQPP\.csv$/.test(name)) out.push(full);
  }
  return out;
}

/** Splits one CSV line (CMS quotes fields that contain commas). */
function fields(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function loadCmsDescriptors2026(root = process.env.CMS_PFS_DIR || "/workspace/healthcare-pfs") {
  const files = findCsvs(root);
  if (files.length === 0) return null;
  const names = new Set();
  for (const file of files) {
    for (const line of readFileSync(file, "latin1").split(/\r?\n/)) {
      const f = fields(line);
      if (!/^(?=.*\d)[A-Z0-9]{5}$/.test(f[0] ?? "")) continue;
      const d = (f[2] ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      if (d) names.add(d);
    }
  }
  return { files, names };
}

/**
 * Case-insensitive hits. A hit needs no letter or digit just before it. CMS cuts short descriptors off at a fixed
 * width ("Assistive technology assess"), so a descriptor of 12+ characters also counts when a word continues it
 * ("...assessment"); a shorter one ("bls", "tdd") must also end at a non-letter, so it never matches inside a word.
 */
export function descriptorHits(text, names) {
  const low = text.toLowerCase();
  const hits = [];
  for (const name of names) {
    let at = low.indexOf(name);
    while (at !== -1) {
      const before = at === 0 ? "" : low[at - 1];
      const after = low[at + name.length] ?? "";
      if (!/[a-z0-9]/.test(before) && (name.length >= 12 || !/[a-z0-9]/.test(after))) { hits.push(name); break; }
      at = low.indexOf(name, at + 1);
    }
  }
  return hits;
}

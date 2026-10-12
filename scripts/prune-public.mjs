/**
 * After the build: in a public build, delete everything that must not be public from the static output.
 *   - CLFS lab files and lab year shards (AMA license pending): NEVER public.
 *   - Rest of New York and other internal-only data, until Shield, Andrea and Aaron clear it.
 * In an internal build (VITE_DEMO_MODE=internal) nothing is removed.
 *
 * Usage: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/prune-public.mjs [dir ...]
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { INTERNAL_ONLY, NEVER_PUBLIC, resolveMode } from "../src/lib/config/mode.ts";

export function walk(dir, root = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, root, out);
    else out.push(relative(root, full).split("\\").join("/"));
  }
  return out;
}

export function removable(path) {
  return NEVER_PUBLIC.some((rule) => rule.test(path)) || INTERNAL_ONLY.some((rule) => rule.test(path));
}

const mode = resolveMode(process.env.VITE_DEMO_MODE);
const dirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [".vercel/output/static", ".output/public"];
if (mode === "internal") {
  console.log("[prune] internal build: nothing removed.");
} else {
  let removed = 0;
  let kept = 0;
  for (const dir of dirs.filter((item) => existsSync(item))) {
    for (const path of walk(dir)) {
      if (removable(path)) {
        rmSync(join(dir, path));
        removed += 1;
      } else kept += 1;
    }
  }
  console.log(`[prune] public build: removed ${removed} held-back files, kept ${kept}.`);
}

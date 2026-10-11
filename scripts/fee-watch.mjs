import { readFileSync, writeFileSync, existsSync } from "node:fs";

const required = ["public/pfs-2026.json", "public/clfs-2026.json", "public/afs-2026.json", "public/dme-2026.json", "public/file-status.json"];
const missing = required.filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.log(JSON.stringify({ ok: false, missing, current: 0, gap: 0 }));
  process.exit(1);
}

const report = JSON.parse(readFileSync("public/file-status.json", "utf8"));
if (!report || !Array.isArray(report.files)) {
  console.log(JSON.stringify({ ok: false, missing: ["public/file-status.json files"], current: 0, gap: 0 }));
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
report.built = today;
writeFileSync("public/file-status.json", `${JSON.stringify(report, null, 2)}\n`);

const current = report.files.filter((file) => file.status === "current").length;
const gap = report.files.filter((file) => file.status === "gap").length;
console.log(JSON.stringify({ ok: true, built: today, missing: [], current, gap }));

import { readFileSync } from "node:fs";
import { regulate } from "../src/lib/watch/regulate.ts";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const duties = regulate({
  physician: read("public/years/physician/9.json")["97110"] ?? null,
  ambulance: read("public/years/ambulance/A.json")["A0428"] ?? null,
  status: read("public/file-status.json"),
});
const failed = duties.filter((duty) => !duty.ok);
console.log(JSON.stringify({ ok: failed.length === 0, duties: duties.map((duty) => `${duty.team}/${duty.sub}: ${duty.ok ? "pass" : "fail"}`) }));
if (failed.length > 0) process.exit(1);

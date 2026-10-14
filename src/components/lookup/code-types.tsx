import { useEffect, useState } from "react";
import { money } from "@/lib/desk/clock";
import { CODE_TYPES, typeRollup } from "@/lib/lookup/code-types";
import type { CheckLine } from "@/lib/lookup/check";

export function CodeTypeList() {
  const [saved, setSaved] = useState<{ name: string; priced: number; empty: number }[] | null>(null);
  useEffect(() => {
    fetch("/saved-codes.json")
      .then((response) => response.ok ? response.json() : null)
      .then((body: { groups?: { name: string; rows: { cents: number | null }[] }[] } | null) => {
        if (!body?.groups) return;
        setSaved(body.groups.map((group) => ({
          name: group.name,
          priced: group.rows.filter((row) => row.cents !== null).length,
          empty: group.rows.filter((row) => row.cents === null).length,
        })));
      })
      .catch(() => setSaved(null));
  }, []);
  return (
    <div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {CODE_TYPES.filter((type) => type.id !== "none" && type.id !== "other").map((type) => (
          <li key={type.id} className="rounded-[10px] bg-paper-2 px-4 py-3">
            <p className="text-sm font-medium text-ink">{type.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{type.file}</p>
          </li>
        ))}
      </ul>
      {saved ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Saved from the posted files: {saved.map((group) => `${group.name}, ${group.priced} with a dollar${group.empty ? `, ${group.empty} with no dollar` : ""}`).join(". ")}. A 2022 or 2024 amount is not used for 2026.
        </p>
      ) : null}
    </div>
  );
}

export function TypeRollup({ lines }: { lines: Array<{ schedule: CheckLine["schedule"]; fileCents: number | null; units: number | null; seqRate: number | null; adminCents: number | null; otherCents: number | null }> }) {
  const roll = typeRollup(lines);
  if (roll.groups.length === 0) return null;
  return (
    <section className="mt-4">
      <h3 className="text-[17px] font-semibold text-ink">By code type</h3>
      <p className="mt-1 text-sm text-muted">
        You pay {money(roll.totals.payable / 100)} on {roll.totals.payableLines} priced {roll.totals.payableLines === 1 ? "line" : "lines"}.
        Their amount is {money(roll.totals.theirs / 100)}.
        {roll.totals.wrongLines > 0 ? ` Wrong schedule on ${roll.totals.wrongLines} ${roll.totals.wrongLines === 1 ? "line" : "lines"}, ${money(roll.totals.wrongGap / 100)} under the correct fee.` : " No line used a different schedule."}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-2 pr-3 font-medium">Code type</th>
              <th className="py-2 pr-3 font-medium">Lines</th>
              <th className="py-2 pr-3 font-medium">You pay</th>
              <th className="py-2 pr-3 font-medium">Their amount</th>
              <th className="py-2 font-medium">Wrong schedule</th>
            </tr>
          </thead>
          <tbody>
            {roll.groups.map((type) => (
              <tr key={type.id} className="border-b border-line">
                <td className="py-2 pr-3 text-ink">
                  {type.name}
                  <span className="mt-0.5 block text-xs text-muted">{type.file}</span>
                </td>
                <td className="py-2 pr-3 tabular-nums text-ink">{type.count}</td>
                <td className="py-2 pr-3 tabular-nums text-ink">{type.payableLines > 0 ? money(type.payable / 100) : "No dollar"}</td>
                <td className="py-2 pr-3 tabular-nums text-ink">{type.theirLines > 0 ? money(type.theirs / 100) : "None"}</td>
                <td className={type.wrongLines > 0 ? "py-2 font-medium text-alert" : "py-2 text-muted"}>{type.wrongLines > 0 ? `${type.wrongLines} · ${money(type.wrongGap / 100)}` : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

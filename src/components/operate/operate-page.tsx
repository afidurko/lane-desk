import { useEffect, useState, type FormEvent } from "react";
import { Shell } from "@/components/landing/shell";
import { readAudit, recordAudit, type AuditEntry } from "@/lib/compliance/audit";
import { REFUSALS, SKILLS } from "@/lib/compliance/boundary";
import { contain, type PatchAction } from "@/lib/security/patch-net";

export function OperatePage() {
  const [request, setRequest] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [actions, setActions] = useState<PatchAction[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    setAudit(readAudit());
  }, []);

  function scan(event: FormEvent) {
    event.preventDefault();
    const result = contain(request);
    if (result.decision === "stop") recordAudit({ skill: "patch-net", decision: "stop", reason: result.reason });
    setDetail(result.detail);
    setActions(result.actions);
    setRequest("");
    setAudit(readAudit());
  }

  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-[13px] text-muted">Rules</p>
        <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">
          The boundary runs before any skill. It does not keep the text.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          This is a de-identified fee desk. The billing page is a worksheet. It does not transmit a claim, and it is not legal advice. A refusal here does not make a Medicare program compliant.
        </p>

        <ul className="mt-8 space-y-3">
          {REFUSALS.map((rule) => (
            <li key={rule} className="rounded-[10px] bg-paper-2 px-4 py-3 text-sm leading-relaxed text-ink">
              {rule}
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-[22px] font-semibold tracking-tight text-ink">Skills that exist</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SKILLS.map((skill) => (
            <li key={skill.id} className="rounded-[10px] bg-paper-2 p-4">
              <h3 className="text-[17px] font-semibold text-ink">{skill.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{skill.does}</p>
            </li>
          ))}
        </ul>

        <form onSubmit={scan} className="mt-10 max-w-2xl">
          <label htmlFor="request" className="text-sm font-medium text-ink">
            Ask for a skill
          </label>
          <textarea
            id="request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-[10px] bg-paper-2 px-4 py-3 text-base"
          />
          <button type="submit" className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
            Scan it
          </button>
          {detail ? (
            <p className="mt-4 text-sm leading-relaxed text-ink" role="status">
              {detail}
            </p>
          ) : null}
          {actions.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {actions.map((action) => (
                <li key={`${action.team}-${action.threat}`} className="rounded-[10px] bg-paper-2 px-4 py-3 text-sm text-ink">
                  {action.team}. {action.action}
                </li>
              ))}
            </ul>
          ) : null}
        </form>

        <h2 className="mt-12 text-[22px] font-semibold tracking-tight text-ink">Patch network</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The screen strips markup and drops an identifier or an oversized request. A later check stops a submit, a portal, a scrape, or a transmit, then closes pricing, storage, and export. The text is not kept.
        </p>

        <h2 className="mt-12 text-[22px] font-semibold tracking-tight text-ink">Stops recorded here</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">The log keeps the decision and the reason. It does not keep the text.</p>
        <ul className="mt-4 space-y-2">
          {audit.length === 0 ? (
            <li className="text-sm text-muted">No stop has been recorded in this browser.</li>
          ) : (
            audit.map((entry) => (
              <li key={entry.at} className="text-sm text-ink">
                {entry.decision}. {entry.reason}. {entry.skill}.
              </li>
            ))
          )}
        </ul>
      </main>
    </Shell>
  );
}

import { useEffect, useId, useState, type FormEvent } from "react";
import { ENCOUNTERS, PLANS, ROLES, type EncounterId, type PlanId, type ProofRequest, type RoleId } from "./types";
import { screen } from "@/lib/security/mesh";

const STORAGE_KEY = "lane-proof-request";

const PLAN_LABEL: Record<PlanId, string> = {
  stopwatch: "Stopwatch",
  parallel: "Parallel",
  wrap: "Wrap",
};

type Field = "email" | "role";

function isRole(value: string): value is RoleId {
  return ROLES.some((role) => role.id === value);
}

function isEncounter(value: string): value is EncounterId {
  return ENCOUNTERS.some((item) => item.id === value);
}

function readSaved(): ProofRequest | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProofRequest>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.encounter !== "string" ||
      typeof parsed.plan !== "string" ||
      !isRole(parsed.role) ||
      !isEncounter(parsed.encounter) ||
      !PLANS.includes(parsed.plan as PlanId)
    ) {
      return null;
    }
    const email = screen(parsed.email, "email");
    if (email.stop) return null;
    return {
      email: email.text,
      role: parsed.role,
      encounter: parsed.encounter,
      plan: parsed.plan as PlanId,
      at: typeof parsed.at === "string" ? parsed.at : "",
    };
  } catch {
    return null;
  }
}

function labelFor<T extends { id: string; label: string }>(list: readonly T[], id: string) {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function Signup({ plan, onPlan }: { plan: PlanId; onPlan: (plan: PlanId) => void }) {
  const baseId = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const encounter = ENCOUNTERS[0].id;
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saved, setSaved] = useState<ProofRequest | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(readSaved());
    setHydrated(true);
  }, []);

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    const emailScreen = screen(email, "email");
    if (emailScreen.stop) {
      next.email = emailScreen.stop === "oversize" ? "That email is too long." : "Enter a work email.";
    }
    if (!isRole(role)) next.role = "Choose a role.";
    return next;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const order: Field[] = ["email", "role"];
      const first = order.find((field) => next[field]);
      if (first) {
        document.getElementById(`${baseId}-${first}`)?.focus();
      }
      return;
    }
    if (!isRole(role) || !isEncounter(encounter)) return;
    const emailScreen = screen(email, "email");
    if (emailScreen.stop) return;
    const record: ProofRequest = {
      email: emailScreen.text,
      role,
      encounter,
      plan,
      at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setSaved(record);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setSaved(null);
    setErrors({});
  }

  if (!hydrated) {
    return (
      <div className="rounded-2xl bg-paper p-6 text-ink sm:p-8" aria-hidden="true">
        <div className="h-8 w-40 rounded-md bg-line" />
        <div className="mt-6 h-12 rounded-xl bg-line" />
        <div className="mt-4 h-12 rounded-xl bg-line" />
      </div>
    );
  }

  if (saved) {
    return (
      <div className="rounded-2xl bg-paper p-6 text-ink sm:p-8" role="status">
        <p className="text-[13px] text-muted">Proof list</p>
        <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">The therapy schedule. You’re on it.</h3>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {labelFor(ENCOUNTERS, saved.encounter)} · {PLAN_LABEL[saved.plan]} · {labelFor(ROLES, saved.role)}.
          The gold row is written before anyone labels it. Saved for {saved.email} in this browser only —
          nothing was sent, and no note was attached.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-teal"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl bg-paper p-6 text-ink sm:p-8">
      <p className="text-[13px] text-muted">Proof list</p>
      <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">Bring the adult-day schedule.</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Work email only. Stored in this browser so you can see the confirmation. No live PHI. No chart login.
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">Which run</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PLANS.map((id) => {
            const active = plan === id;
            return (
              <label
                key={id}
                className={
                  active
                    ? "flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-teal px-2 text-center text-sm font-medium text-teal-ink"
                    : "flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line px-2 text-center text-sm font-medium text-ink"
                }
              >
                <input
                  type="radio"
                  name={`${baseId}-plan`}
                  value={id}
                  checked={active}
                  onChange={() => onPlan(id)}
                  className="sr-only"
                />
                {PLAN_LABEL[id]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor={`${baseId}-email`} className="text-sm font-medium text-ink">
          Work email
        </label>
        <input
          id={`${baseId}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${baseId}-email-error` : undefined}
          className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-3 text-base text-ink"
          placeholder="you@center.org"
        />
        {errors.email ? (
          <p id={`${baseId}-email-error`} className="mt-1.5 text-sm font-medium text-deep" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor={`${baseId}-role`} className="text-sm font-medium text-ink">
          Role
        </label>
        <select
          id={`${baseId}-role`}
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          aria-invalid={errors.role ? true : undefined}
          aria-describedby={errors.role ? `${baseId}-role-error` : undefined}
          className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-3 text-base text-ink"
        >
          <option value="">Select a role</option>
          {ROLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {errors.role ? (
          <p id={`${baseId}-role-error`} className="mt-1.5 text-sm font-medium text-deep" role="alert">
            {errors.role}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-ink">Encounter on the clock</p>
        <p className="mt-1.5 flex min-h-12 items-center rounded-[10px] bg-paper-2 px-3 text-base text-ink">
          {ENCOUNTERS[0].label}
        </p>
        <p className="mt-1.5 text-sm text-muted">One type until this run has a number.</p>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep"
      >
        Request {PLAN_LABEL[plan]}
      </button>
    </form>
  );
}

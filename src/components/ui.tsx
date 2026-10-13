import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IS_INTERNAL, REFERENCE_NOTE, scopeLabel } from "@/lib/config/mode";
import { Shell } from "@/components/landing/shell";

/** One primary look. A screen has exactly one of these. */
export const PRIMARY =
  "inline-flex h-12 items-center justify-center rounded-full bg-teal px-6 text-sm font-medium text-teal-ink transition-colors duration-200 hover:bg-deep disabled:cursor-default disabled:opacity-60";
/** Everything else on the screen. */
export const SECONDARY =
  "inline-flex h-12 items-center justify-center rounded-full border border-muted px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-teal disabled:cursor-default disabled:opacity-60";
export const LINK = "text-sm font-medium text-teal underline underline-offset-4 hover:text-deep";
export const FIELD = "mt-1.5 w-full rounded-2xl border border-muted bg-paper-2 px-4 text-base text-ink placeholder:text-muted";

export function Page({ kicker, title, lede, children }: { kicker: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <Shell>
      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">{kicker}</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {lede ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{lede}</p> : null}
        <div className="mt-8">{children}</div>
      </main>
    </Shell>
  );
}

/** Goes under every price output. The words are fixed. */
export function ReferenceNote({ scope = true }: { scope?: boolean }) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-muted" data-reference-note>
      <strong className="font-medium text-ink">{REFERENCE_NOTE}.</strong>
      {scope ? ` ${scopeLabel()}. PACE is capitated, so this is a check figure, not what anyone is paid.` : ""}
    </p>
  );
}

export function DeidWarning({ id }: { id?: string }) {
  return (
    <p id={id} className="mt-2 rounded-xl border border-line bg-wash px-3 py-2 text-sm leading-relaxed text-ink" role="note">
      <strong className="font-medium">De-identified only.</strong> No names, dates of birth, member or record numbers, phone numbers, or
      addresses. The tool refuses obvious identifier patterns (record numbers, birth dates, phone numbers, emails, long digit strings). It
      cannot recognize a name, so you must de-identify first.
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-muted/50 px-4 py-5 text-sm leading-relaxed text-muted">{children}</p>;
}

/** Shown in place of a screen that is internal only in a public build. */
export function InternalOnly({ name }: { name: string }) {
  if (IS_INTERNAL) return null;
  return (
    <Page
      kicker="Not in the public demo"
      title={`${name} is not part of this demo.`}
      lede="This screen holds figures that are still being checked. The demo covers a sample note, an invoice check, a code lookup, the proof, and pricing."
    >
      <Link to="/" className={PRIMARY}>
        Back to the start
      </Link>
    </Page>
  );
}

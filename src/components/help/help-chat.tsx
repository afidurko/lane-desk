import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { classifyIssue, type IssueKind } from "@/lib/help/issues";

type Turn = {
  id: string;
  role: "you" | "desk";
  text: string;
  kind?: IssueKind;
  href?: "/billing" | "/book" | "/desk" | "/ny" | "/operate" | "/filter";
  hrefLabel?: string;
  suggestions?: string[];
};

const STARTERS = ["The amount does not match", "Import a CSV", "Can this be submitted?"];

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: "start",
      role: "desk",
      kind: "ask",
      text: "One next step at a time. A name or a member number is dropped.",
      suggestions: ["Add the organization", "The amount does not match", "Can this be submitted?"],
    },
  ]);

  function ask(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length < 2) return;
    const reply = classifyIssue(trimmed);
    const kept = reply.kind !== "stop";
    setTurns((current) => [
      ...current,
      { id: `you-${current.length}`, role: "you", text: kept ? trimmed : "Not shown." },
      {
        id: `desk-${current.length}`,
        role: "desk",
        kind: reply.kind,
        text: `${reply.title}. ${reply.body}`,
        href: reply.href,
        hrefLabel: reply.hrefLabel,
        suggestions: reply.suggestions,
      },
    ]);
    setText("");
  }

  function send(event: FormEvent) {
    event.preventDefault();
    ask(text);
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open ? (
        <section className="flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_16px_40px_rgba(22,56,50,0.12)]">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="font-display text-lg text-ink">Help</p>
              <p className="text-xs text-muted">Workable fixes, and stops.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full px-3 text-sm text-muted hover:text-ink">
              Close
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.map((turn) => (
              <article key={turn.id} className={turn.role === "you" ? "ml-8" : "mr-6"}>
                <p
                  className={
                    turn.kind === "stop"
                      ? "rounded-2xl border border-deep bg-wash px-3 py-2 text-sm leading-relaxed text-deep"
                      : turn.role === "you"
                        ? "rounded-2xl bg-ink px-3 py-2 text-sm leading-relaxed text-paper"
                        : "rounded-2xl border border-line bg-paper-2 px-3 py-2 text-sm leading-relaxed text-ink"
                  }
                >
                  {turn.text}
                </p>
                {turn.href && turn.hrefLabel ? (
                  <Link to={turn.href} className="mt-2 inline-flex h-10 items-center text-sm font-medium text-teal">
                    {turn.hrefLabel}
                  </Link>
                ) : null}
                {turn.suggestions && turn.role === "desk" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {turn.suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => ask(suggestion)} className="rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-teal">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button key={starter} type="button" onClick={() => ask(starter)} className="rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-teal">
                  {starter}
                </button>
              ))}
            </div>
            <form onSubmit={send} className="flex gap-2">
              <label className="sr-only" htmlFor="help-text">
                Describe the issue
              </label>
              <input
                id="help-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What is stuck?"
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-paper-2 px-4 text-sm"
              />
              <button type="submit" className="h-11 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink">
                Send
              </button>
            </form>
          </div>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-12 rounded-full bg-deep px-5 text-sm font-medium text-paper shadow-[0_8px_24px_rgba(22,56,50,0.2)]"
        aria-expanded={open}
      >
        {open ? "Hide help" : "Help"}
      </button>
    </div>
  );
}

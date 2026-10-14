import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, FileSpreadsheet, ChartColumn, Wallet, CircleDollarSign } from "lucide-react";
import { HelpChat } from "@/components/help/help-chat";

export const NAV = [
  { href: "/", label: "Sheet" },
  { href: "/trends", label: "Trends" },
  { href: "/pay", label: "Pay" },
  { href: "/code", label: "Price" },
] as const;

const ICONS = {
  "/": FileSpreadsheet,
  "/trends": ChartColumn,
  "/pay": Wallet,
  "/code": CircleDollarSign,
} as const;

const MORE = [
  { href: "/ny", label: "New York" },
  { href: "/billing", label: "Review" },
  { href: "/history", label: "What changed" },
  { href: "/pace", label: "Monthly program" },
  { href: "/ops", label: "File dates" },
] as const;

export function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-deep" />
      <circle cx="16" cy="16" r="7" className="stroke-paper" fill="none" strokeWidth="1.6" />
      <path
        d="M16 9.5V16.2l4.2 2.4"
        className="stroke-paper"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    let last = 0;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const next = y > last && y > 48;
        last = y;
        setCompact((current) => (current === next ? current : next));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="min-h-screen text-ink">
      <header className="glass fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 font-medium text-ink">
            <Mark />
            <span className="font-display text-xl tracking-tight">Lane</span>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-ink"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "More pages"}</span>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open ? (
          <nav id="mobile-nav" className="border-t border-line px-5 py-2" aria-label="More">
            {MORE.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center text-base text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <nav className="hidden border-b border-line md:block" aria-label="Steps">
        <ol className="mx-auto flex max-w-3xl gap-2 px-5 py-3">
          {NAV.map((item) => {
            const current = path === item.href;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  to={item.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "press flex h-9 items-center justify-center gap-1.5 rounded-full bg-teal px-3 text-[13px] font-semibold text-white"
                      : "press flex h-9 items-center justify-center gap-1.5 rounded-full bg-paper-2 px-3 text-[13px] font-medium text-ink"
                  }
                >
                  {(() => {
                    const Icon = ICONS[item.href];
                    return <Icon className="size-4" aria-hidden="true" />;
                  })()}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <div key={path} className="arrive pt-16 pb-28 md:pb-0">{children}</div>
      <HelpChat />
      <nav className={compact ? "glass fixed inset-x-8 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-full px-2 transition-all duration-300 md:hidden" : "glass fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-full px-1 transition-all duration-300 md:hidden"} aria-label="Steps">
        <ol className="grid grid-cols-4">
          {NAV.map((item) => {
            const current = path === item.href;
            const Icon = ICONS[item.href];
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  aria-current={current ? "page" : undefined}
                  className={current ? "press relative z-10 m-1 flex flex-col items-center justify-center gap-0.5 rounded-full bg-teal text-teal-ink" : "press relative z-10 flex flex-col items-center justify-center gap-0.5 text-muted"}
                  style={{ height: compact ? 44 : 52 }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className={compact ? "sr-only" : "text-[12px] font-medium"}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <footer className="hidden border-t border-line bg-paper md:block">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display text-xl text-ink">
              <Mark />
              Lane
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">Lane compares the sheet to the posted file. Nothing is sent.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Footer">
            {[...NAV, ...MORE].map((item) => (
              <Link key={item.href} to={item.href} className="text-muted hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

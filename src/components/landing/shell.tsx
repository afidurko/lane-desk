import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { HelpChat } from "@/components/help/help-chat";
import { IS_INTERNAL, PUBLIC_SCOPE } from "@/lib/config/mode";

type NavItem = { href: string; label: string };

/** Plain words, one job each. Public demo and internal build share these. */
export const PUBLIC_NAV: readonly NavItem[] = [
  { href: "/desk", label: "Try a note" },
  { href: "/invoice", label: "Check an invoice" },
  { href: "/code", label: "Look up a code" },
  { href: "/proof", label: "Proof" },
  { href: "/about", label: "What this is" },
  { href: "/pricing", label: "Pricing" },
];

/** Internal only. Never linked from a public build. */
export const INTERNAL_NAV: readonly NavItem[] = [
  { href: "/pace", label: "PACE month" },
  { href: "/billing", label: "Claim worksheet" },
  { href: "/book", label: "Code book" },
  { href: "/filter", label: "Filter codes" },
  { href: "/ny", label: "New York" },
  { href: "/history", label: "Codes that changed" },
  { href: "/ops", label: "File status" },
  { href: "/team", label: "Team" },
  { href: "/compete", label: "Leave-behind" },
  { href: "/operate", label: "Rules" },
  { href: "/why", label: "Why" },
  { href: "/run", label: "Sample file" },
];

export const NAV: readonly NavItem[] = IS_INTERNAL ? [...PUBLIC_NAV, ...INTERNAL_NAV] : PUBLIC_NAV;

const STEPS: readonly (NavItem & { n: string })[] = [
  { href: "/desk", n: "1", label: "Try a note" },
  { href: "/invoice", n: "2", label: "Check an invoice" },
  { href: "/request", n: "3", label: "Request a pilot" },
];

export function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-teal" />
      <circle cx="16" cy="16" r="7" className="stroke-paper" fill="none" strokeWidth="1.6" />
      <path d="M16 9.5V16.2l4.2 2.4" className="stroke-paper" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-teal focus:px-4 focus:py-2 focus:text-sm focus:text-teal-ink"
      >
        Skip to the page
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 font-medium text-ink">
            <Mark />
            <span className="font-display text-xl tracking-tight">Lane</span>
          </Link>
          <p className="hidden text-sm text-muted xl:block">
            {IS_INTERNAL ? "Internal build · Rest of NY · 13282 / 99" : `Medicare reference prices · ${PUBLIC_SCOPE.short}`}
          </p>
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
            {PUBLIC_NAV.map((item) => {
              const current = path === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={current ? "page" : undefined}
                  className={current ? "text-sm font-medium text-ink" : "text-sm text-muted transition-colors duration-200 hover:text-ink"}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full border border-line text-ink lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-nav" className="border-t border-line px-5 py-2 lg:hidden" aria-label="Mobile">
            {NAV.map((item) => (
              <Link key={item.href} to={item.href} onClick={() => setOpen(false)} className="flex h-12 items-center text-base text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      {STEPS.some((step) => step.href === path) ? (
        <nav className="border-b border-line" aria-label="Steps">
          <ol className="mx-auto flex max-w-6xl gap-2 px-5 py-3">
            {STEPS.map((layer) => {
              const current = path === layer.href;
              return (
                <li key={layer.href} className="min-w-0 flex-1">
                  <Link
                    to={layer.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "flex h-11 items-center justify-center gap-2 rounded-full border-2 border-teal bg-wash px-3 text-sm font-medium text-ink"
                        : "flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-paper-2 px-3 text-sm text-muted hover:text-ink"
                    }
                  >
                    <span className="tabular-nums">{layer.n}</span>
                    <span className="truncate">{layer.label}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      {children}
      {IS_INTERNAL ? <HelpChat /> : null}
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display text-xl text-ink">
              <Mark />
              Lane
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Medicare reference prices for checking vendor bills and encounter data. Not a payment. Not an EHR. De-identified only.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Footer">
            {NAV.map((item) => (
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

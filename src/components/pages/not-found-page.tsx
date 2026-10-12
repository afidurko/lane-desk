import { Link } from "@tanstack/react-router";
import { PRIMARY, Page, SECONDARY } from "@/components/ui";

/** Shown for any path that is not a screen. The server still answers 404. It never repeats the path that was asked for. */
export function NotFoundPage() {
  return (
    <Page kicker="Not Found" title="We couldn't find that page.">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className={PRIMARY}>
          Back to the start
        </Link>
      </div>
      <nav aria-label="Main steps" className="mt-8">
        <p className="text-sm text-muted">Or go straight to a step:</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/desk" className={SECONDARY}>
            Try a note
          </Link>
          <Link to="/invoice" className={SECONDARY}>
            Check an invoice
          </Link>
          <Link to="/request" className={SECONDARY}>
            Request a pilot
          </Link>
        </div>
      </nav>
    </Page>
  );
}

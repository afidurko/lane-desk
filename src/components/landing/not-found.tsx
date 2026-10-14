import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <p className="text-[13px] text-muted">Not found</p>
      <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight text-ink">That page is not here.</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">Go back to the four teams.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="inline-flex h-12 items-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">Teams</Link>
        <Link to="/code" className="inline-flex h-12 items-center rounded-full border border-line px-5 text-sm font-medium text-ink">Price</Link>
        <Link to="/ny" className="inline-flex h-12 items-center rounded-full border border-line px-5 text-sm font-medium text-ink">New York</Link>
      </div>
    </main>
  );
}

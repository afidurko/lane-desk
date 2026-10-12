import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LINK, Page, PRIMARY } from "@/components/ui";
import { IS_INTERNAL, REFERENCE_NOTE } from "@/lib/config/mode";

type Year = { year: number; release: string };

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AboutPage() {
  const [years, setYears] = useState<Year[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/proof.json")
      .then((response) => (response.ok ? (response.json() as Promise<{ years: Year[] }>) : Promise.reject(new Error("missing"))))
      .then((file) => !cancel && setYears(file.years))
      .catch(() => !cancel && setFailed(true));
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <Page
      kicker="What this is"
      title="What this is, what it is not, and what it covers"
      lede="One page, in plain words, so nobody has to guess."
    >
      <section aria-labelledby="is-h">
        <h2 id="is-h" className="font-display text-2xl text-ink">
          What it is
        </h2>
        <List
          items={[
            "A way to read a short, de-identified therapy note and name the billing code the note supports.",
            "A way to look up a code and see the Medicare reference price from the loaded CMS fee schedule file.",
            "A way to check invoice lines against that reference price for the year of service.",
          ]}
        />
      </section>

      <section className="mt-10" aria-labelledby="isnt-h">
        <h2 id="isnt-h" className="font-display text-2xl text-ink">
          What it is not
        </h2>
        <List
          items={[
            `${REFERENCE_NOTE}. PACE is capitated, so a reference price is a check figure and not what anyone is paid.`,
            "Not an EHR. It does not hold a chart, and it does not replace yours.",
            "Not a claim submitter. It sends nothing to Medicare, Medicaid, or a plan.",
            "Not for patient information. De-identified only. A note with an obvious identifier is refused, but that is a safety net, not a guarantee.",
            "Not clinical advice. Codes are provisional until a clinician reviews them.",
            "Not a measured time saver yet. No one has timed a manual desk against it.",
          ]}
        />
      </section>

      <section className="mt-10" aria-labelledby="where-h">
        <h2 id="where-h" className="font-display text-2xl text-ink">
          Coverage: New York only
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink">
          Lane covers New York only. Other states are not loaded and are not offered.{" "}
          {IS_INTERNAL
            ? "This internal build shows New York locality prices, with Rest of New York (Medicare administrative contractor 13282, locality 99) as the default. Manhattan, NYC suburbs and Long Island, Poughkeepsie and northern NYC suburbs, and Queens are offered because the loaded file carries them."
            : "This public demo shows the national Medicare amount for 2026 as the reference. New York locality prices, with Rest of New York as the default, are held back until they are cleared for public use."}
        </p>
      </section>

      <section className="mt-10" aria-labelledby="data-h">
        <h2 id="data-h" className="font-display text-2xl text-ink">
          Data sources and years
        </h2>
        <List
          items={[
            "Source: the CMS Medicare Physician Fee Schedule relative value files. Amounts are the file's non-facility total times that year's conversion factor.",
            IS_INTERNAL
              ? "Years loaded: 2020 to 2026. The public demo shows 2026 only."
              : "Year shown in this demo: 2026. The proof page checks every year from 2020 to 2026.",
            "Names are the short descriptions on the CMS file. Longer code descriptions are not included.",
            "Not included: clinical laboratory fee schedule data. It is held back until the licensing question is settled.",
            "CPT is a registered trademark of the American Medical Association.",
          ]}
        />
        {years ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Files on record: {years.map((year) => `${year.year} ${year.release}`).join(", ")}.
          </p>
        ) : null}
        {failed ? <p className="mt-3 text-sm text-muted">The list of files did not load. Reload the page.</p> : null}
      </section>

      <section className="mt-10" aria-labelledby="status-h">
        <h2 id="status-h" className="font-display text-2xl text-ink">
          Review status
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink">
          Provisional. Codes the coder chooses have not been reviewed by a clinical subject-matter expert. Prices are checked against the
          CMS files, and that check is on the proof page. Pricing on this site is a list shape, not a quote.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <Link to="/desk" className={PRIMARY}>
          Try a sample note
        </Link>
        <Link to="/proof" className={LINK}>
          See the proof
        </Link>
      </div>
    </Page>
  );
}

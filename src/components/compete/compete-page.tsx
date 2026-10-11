import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/landing/shell";

const LOADED = [
  { name: "Physician fee schedule", span: "2020–2026", count: "About 19,000 codes a year", note: "Rest of New York, MAC 13282, locality 99" },
  { name: "Clinical laboratory", span: "2020–2026, fourth quarter", count: "About 2,200 codes", note: "80053 is $10.56 in 2026" },
  { name: "Ambulance", span: "2020–2026", count: "About 1,300 rows", note: "Urban, rural, and quartile" },
  { name: "DMEPOS", span: "2021–2026", count: "New York rural and non-rural", note: "2020 fee file was not in that year’s zip" },
  { name: "Hospital outpatient", span: "October 2026", count: "Addendum B", note: "Only October through December 2026" },
  { name: "Ambulatory surgical center", span: "October 2026", count: "Addendum AA and BB", note: "Only October through December 2026" },
  { name: "Inpatient PPS", span: "FY 2026", count: "Weights and national amounts", note: "Not wage-adjusted" },
  { name: "Part B drug ASP", span: "October 2026", count: "Quarterly", note: "Only October through December 2026" },
  { name: "NY Medicaid fee-for-service", span: "As posted", count: "Physician, lab, transport, dental, DME, and others", note: "Managed-care plan rates are not loaded" },
  { name: "NADAC", span: "Week of October 7, 2026", count: "About 30,000 rows", note: "Acquisition cost, not a pharmacy payment" },
] as const;

const THEY = [
  "Full EHR, including medication, labs, assessments, and care plans.",
  "Enrollment, day center, transportation, and interdisciplinary team tools.",
  "Claims administration, in-house or through a third-party administrator.",
  "Analytics, scorecards, and compliance reporting.",
  "More than half of PACE centers, 23 states, 30 years, HITRUST e1, SOC 2 Type II.",
] as const;

const WE = [
  "A de-identified note goes in. A code and a reference price come out. The clock is timed against a human desk.",
  "The chart stays. No rip-out. No portal. No live identifiers.",
  "Physician, lab, ambulance, and equipment files from 2020 or 2021 through 2026 are already loaded.",
  "Rest of New York is the default. Sequestration is applied by date of service, not invented.",
  "PACE is capitated. The dollar is a Medicare fee-for-service reference price for checking vendor bills, not a payment.",
] as const;

export function CompetePage() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">Leave-behind</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Price the note. Leave the chart.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          CollabriosONE is an operating platform. This is the claims desk that sits beside it. A person currently reads the note, assigns the code, and looks up the allowed amount. That labor is what gets automated.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <dt className="text-xs font-medium tracking-widest text-teal uppercase">MAC</dt>
            <dd className="mt-2 font-display text-2xl text-ink">13282 / 99</dd>
            <dd className="mt-1 text-sm text-muted">Rest of New York. National Government Services, Jurisdiction K.</dd>
          </div>
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <dt className="text-xs font-medium tracking-widest text-teal uppercase">Sequestration</dt>
            <dd className="mt-2 font-display text-2xl text-ink">2 percent</dd>
            <dd className="mt-1 text-sm text-muted">Federal, CARC 253, for dates of service on or after July 1, 2022. It cuts the Medicare payment, not the fee.</dd>
          </div>
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <dt className="text-xs font-medium tracking-widest text-teal uppercase">Codes on the desk</dt>
            <dd className="mt-2 font-display text-2xl text-ink">19,000+</dd>
            <dd className="mt-1 text-sm text-muted">Physician file for 2026. Not six. The six are what the clock can read from prose.</dd>
          </div>
        </dl>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-line bg-paper-2 p-6">
            <h2 className="font-display text-2xl text-ink">What Collabrios runs</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink">
              {THEY.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Public claims from collabrios.com and the September 17, 2026 CollabriosONE announcement. No pricing is published.</p>
          </article>
          <article className="rounded-2xl border border-teal bg-wash p-6">
            <h2 className="font-display text-2xl text-deep">What this desk automates</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink">
              {WE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-3xl text-ink">Loaded since 2022</h2>
          <ul className="mt-4 space-y-3">
            {LOADED.map((row) => (
              <li key={row.name} className="rounded-2xl border border-line px-4 py-3 text-sm text-ink">
                <span className="font-medium">{row.name}.</span> {row.span}. {row.count}. {row.note}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-line bg-paper-2 p-6">
          <h2 className="font-display text-2xl text-ink">What is not claimed</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
            <li>This is not an EHR. It does not replace a chart.</li>
            <li>It does not submit a claim, log into a portal, or store an identifier.</li>
            <li>It does not invent a clinician label. A gold set is labeled by a person.</li>
            <li>Rehab procedure 97110 on New York Medicaid, chiropractic, no-fault, and the sold workers’ compensation physician schedule still have no public dollar file.</li>
            <li>Wage index is not applied to hospital outpatient or inpatient amounts.</li>
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/desk" className="inline-flex h-12 items-center rounded-full bg-teal px-5 text-sm font-medium text-teal-ink">
            Run the clock
          </Link>
          <Link to="/book" className="inline-flex h-12 items-center rounded-full border border-muted px-5 text-sm font-medium text-ink">
            Look up a code
          </Link>
          <Link to="/team" className="inline-flex h-12 items-center rounded-full border border-muted px-5 text-sm font-medium text-ink">
            See the team
          </Link>
        </div>
      </main>
    </Shell>
  );
}

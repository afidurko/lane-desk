import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { FIELD, LINK, Page, PRIMARY, SECONDARY } from "@/components/ui";
import { PLANS, planOf } from "@/lib/billing/plans";
import { mailtoLink, summaryText, validateRequest, type Errors, type InvoiceRequest } from "@/lib/billing/invoice-request";

const TO = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_INVOICE_REQUEST_EMAIL;

export function RequestPage() {
  const [plan, setPlan] = useState<string>("stopwatch");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [centers, setCenters] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<InvoiceRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [testPaid, setTestPaid] = useState(false);
  const id = useId();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chosen = planOf(params.get("plan"));
    if (chosen) setPlan(chosen.id);
    if (params.get("paid") === "test") setTestPaid(true);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateRequest({ company, contact, email, centers, plan });
    if (!result.ok) {
      setErrors(result.errors);
      setDone(null);
      return;
    }
    setErrors({});
    setDone(result.request);
    setCopied(false);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download(text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lane-invoice-request.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  const text = done ? summaryText(done) : "";
  const mail = done ? mailtoLink(TO, done) : null;

  const field = (
    key: keyof Errors,
    label: string,
    value: string,
    set: (v: string) => void,
    props: Record<string, string | number> = {},
  ) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        value={value}
        onChange={(event) => set(event.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-err` : undefined}
        required
        className={`${FIELD} h-12`}
        {...props}
      />
      {errors[key] ? (
        <p id={`${id}-${key}-err`} className="mt-1.5 text-sm font-medium text-deep" role="alert">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );

  return (
    <Page
      kicker="Step 3 of 3"
      title="Request a pilot or an invoice"
      lede="Four details and a plan. This page does not charge anything, does not store anything, and does not send anything."
    >
      {testPaid ? (
        <p className="mb-6 rounded-2xl border border-line bg-wash px-4 py-3 text-sm text-ink" role="status">
          Test mode: a test checkout finished. No real charge was made.
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="space-y-5" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="sr-only">
          Invoice request
        </h2>
        <p className="rounded-xl border border-line bg-wash px-3 py-2 text-sm leading-relaxed text-ink" role="note">
          <strong className="font-medium">Organization details only.</strong> Do not enter patient information or anything clinical. There
          is no free-text box on purpose.
        </p>
        <div>
          <label htmlFor={`${id}-plan`} className="text-sm font-medium text-ink">
            Plan
          </label>
          <select id={`${id}-plan`} value={plan} onChange={(event) => setPlan(event.target.value)} className={`${FIELD} h-12`}>
            {PLANS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {field("company", "Company name", company, setCompany, { autoComplete: "organization", maxLength: 100 })}
        {field("contact", "Contact name", contact, setContact, { autoComplete: "name", maxLength: 100 })}
        {field("email", "Work email", email, setEmail, { type: "email", autoComplete: "email", maxLength: 254 })}
        {field("centers", "Number of centers", centers, setCenters, { inputMode: "numeric", maxLength: 3 })}
        <button type="submit" className={PRIMARY}>
          Prepare my request
        </button>
      </form>

      <section className="mt-10" aria-labelledby={`${id}-out`} aria-live="polite">
        <h2 id={`${id}-out`} className="font-display text-2xl text-ink">
          Your request
        </h2>
        {!done ? (
          <p className="mt-3 rounded-2xl border border-dashed border-muted/50 px-4 py-5 text-sm leading-relaxed text-muted">
            Nothing yet. Fill in the form and choose “Prepare my request”. A summary you can copy appears here.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            <pre className="overflow-x-auto rounded-2xl border border-line bg-paper-2 p-4 text-sm leading-relaxed whitespace-pre-wrap text-ink">
              {text}
            </pre>
            <p className="text-sm leading-relaxed text-muted">
              Not sent and not stored. To go ahead, send this text to your Lane contact{mail ? ", or use the email button" : ""}. Closing
              this page clears it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={SECONDARY} onClick={() => copy(text)}>
                {copied ? "Copied" : "Copy the request"}
              </button>
              <button type="button" className={SECONDARY} onClick={() => download(text)}>
                Download as text
              </button>
              {mail ? (
                <a href={mail} className={SECONDARY}>
                  Open in my email app
                </a>
              ) : null}
            </div>
          </div>
        )}
      </section>
      <p className="mt-8 border-t border-line pt-5">
        <Link to="/pricing" className={LINK}>
          Back to the plans
        </Link>
      </p>
    </Page>
  );
}

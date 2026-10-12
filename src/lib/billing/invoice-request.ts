import { screen } from "@/lib/security/mesh";
import { PLAN_IDS, planOf, type PlanId } from "@/lib/billing/plans";

/**
 * The request-an-invoice form takes four things and nothing else:
 * company name, contact name, email, number of centers. No free text, no clinical field, no patient field.
 * Nothing is stored and nothing is sent from here. The person copies the summary or opens their own mail app.
 */
export type InvoiceRequestInput = {
  company: string;
  contact: string;
  email: string;
  centers: string;
  plan: string;
};

export type InvoiceRequest = {
  company: string;
  contact: string;
  email: string;
  centers: number;
  plan: PlanId;
};

export type Errors = Partial<Record<keyof InvoiceRequestInput, string>>;

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const NAME = /^[\p{L}\p{N} .,'&()/-]+$/u;

export const FIELDS = ["company", "contact", "email", "centers"] as const;

export function validateRequest(input: InvoiceRequestInput): { ok: true; request: InvoiceRequest } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const company = input.company.trim();
  const contact = input.contact.trim();
  const email = input.email.trim();
  const centersText = input.centers.trim();

  if (company.length < 2 || company.length > 100) errors.company = "Enter the organization name, 2 to 100 characters.";
  else if (!NAME.test(company)) errors.company = "Use letters, numbers, and ordinary punctuation only.";

  if (contact.length < 2 || contact.length > 100) errors.contact = "Enter the name of the person to contact.";
  else if (!NAME.test(contact)) errors.contact = "Use letters, numbers, and ordinary punctuation only.";

  if (!EMAIL.test(email) || email.length > 254) errors.email = "Enter a work email address.";

  const centers = Number(centersText);
  if (!/^\d{1,3}$/.test(centersText) || !Number.isInteger(centers) || centers < 1 || centers > 500) {
    errors.centers = "Enter the number of centers as a whole number from 1 to 500.";
  }

  // The identifier screen is for the name fields. An email address is expected in the email field.
  for (const key of ["company", "contact"] as const) {
    if (!errors[key] && screen(input[key], "field").stop)
      errors[key] = "That looks like an identifier. Enter the organization or person name only.";
  }

  const plan = planOf(input.plan);
  if (!plan) errors.plan = `Choose one of: ${PLAN_IDS.join(", ")}.`;

  if (Object.keys(errors).length > 0 || !plan) return { ok: false, errors };
  return { ok: true, request: { company, contact, email, centers, plan: plan.id } };
}

/** Plain text the person can copy or send themselves. Contains only the four fields and the plan. */
export function summaryText(request: InvoiceRequest): string {
  const plan = planOf(request.plan);
  return [
    "Invoice request (no payment taken, nothing stored)",
    `Plan: ${plan?.name ?? request.plan}`,
    `Organization: ${request.company}`,
    `Contact: ${request.contact}`,
    `Email: ${request.email}`,
    `Number of centers: ${request.centers}`,
    "",
    "No patient information is included in this request.",
  ].join("\n");
}

/** A mailto link, only when an address is configured. The visitor's own mail app sends it, if they choose to. */
export function mailtoLink(to: string | undefined, request: InvoiceRequest): string | null {
  const address = (to ?? "").trim();
  if (!EMAIL.test(address)) return null;
  const subject = `Invoice request: ${request.company}`;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summaryText(request))}`;
}

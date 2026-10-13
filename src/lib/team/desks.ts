export type Desk = {
  id: "intake" | "price" | "new-york" | "review";
  name: string;
  href: "/" | "/code" | "/ny" | "/billing";
  hash?: "intake";
  does: string;
  doesNot: string;
};

/** The four teams a person can hand work to. Names are jobs. */
export const DESKS: readonly Desk[] = [
  {
    id: "intake",
    name: "Intake",
    href: "/",
    hash: "intake",
    does: "Reads a bill. Each line needs a code, a date, and a charge.",
    doesNot: "Does not invent a code that is not written on the line.",
  },
  {
    id: "price",
    name: "Price",
    href: "/code",
    does: "One code. The file name, and the amount for each year on the file.",
    doesNot: "Does not guess a code the file does not contain.",
  },
  {
    id: "new-york",
    name: "New York",
    href: "/ny",
    does: "Olean and Allegany only. Personal care from January 1, 2024.",
    doesNot: "Does not use another county’s rate for these two places.",
  },
  {
    id: "review",
    name: "Review",
    href: "/billing",
    does: "Holds the saved lines and marks a charge that does not match the file.",
    doesNot: "Does not send the bill. A person decides.",
  },
];

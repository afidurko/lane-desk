import { blockedText, canEnroll, type Person } from "@/lib/pace/gates";

const KEY = "lane-pace";

export type Meeting = { id: string; date: string; present: string[]; note: string };
export type Day = { id: string; date: string; present: string[] };
export type Ride = { id: string; date: string; personId: string; trip: "Center" | "Clinic" | "Home" };

export type PaceBook = {
  center: string;
  year: number;
  medicaid: Record<string, number>;
  people: Person[];
  meetings: Meeting[];
  days: Day[];
  rides: Ride[];
};

export function emptyBook(): PaceBook {
  return { center: "", year: 2026, medicaid: {}, people: [], meetings: [], days: [], rides: [] };
}

export function readPace(): PaceBook {
  if (typeof window === "undefined") return emptyBook();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "") as PaceBook;
    if (!parsed || !Array.isArray(parsed.people)) return emptyBook();
    return { ...emptyBook(), ...parsed };
  } catch {
    return emptyBook();
  }
}

export function writePace(book: PaceBook) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(book));
}

export function addPerson(book: PaceBook, county: string): { book: PaceBook; error: string | null } {
  const next = book.people.length + 1;
  const person: Person = {
    id: crypto.randomUUID(),
    label: `Participant ${next}`,
    county,
    medicare: true,
    medicaid: true,
    esrd: false,
    age55: false,
    inArea: false,
    voluntary: false,
    community: false,
    loc: "open",
  };
  return { book: { ...book, people: [...book.people, person] }, error: null };
}

export function setCenter(book: PaceBook, center: string): { book: PaceBook; error: string | null } {
  const error = blockedText(center);
  if (error) return { book, error };
  return { book: { ...book, center }, error: null };
}

export function enrollable(person: Person) {
  return canEnroll(person);
}

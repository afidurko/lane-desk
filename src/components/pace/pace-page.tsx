import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/landing/shell";
import { money } from "@/lib/desk/clock";
import { canEnroll, gateGaps, missingSeats, monthLine, SEATS, type Person } from "@/lib/pace/gates";
import { COUNTIES, PART_D_BID, RATE_SOURCE, medicareCents } from "@/lib/pace/rates";
import { addPerson, readPace, setCenter, writePace, type Day, type Meeting, type PaceBook, type Ride } from "@/lib/pace/store";

const TABS = ["Month", "People", "Meeting", "Day", "Rides", "Review"] as const;

export function PacePage() {
  const [book, setBook] = useState<PaceBook | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Month");
  const [error, setError] = useState<string | null>(null);
  const [county, setCounty] = useState<string>("Cattaraugus");

  useEffect(() => {
    setBook(readPace());
  }, []);

  function save(next: PaceBook) {
    setBook(next);
    writePace(next);
  }

  if (!book) return <Shell><main className="mx-auto max-w-xl px-5 py-10 text-sm text-muted">Loading the month.</main></Shell>;

  const enrolled = book.people.filter(canEnroll);
  const lines = enrolled.map((person) => ({ person, line: monthLine(person, book.year, book.medicaid[person.county] ?? null) }));
  const monthTotal = lines.reduce((sum, row) => sum + (row.line.total ?? 0), 0);

  return (
    <Shell>
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-medium tracking-widest text-teal uppercase">PACE · Cattaraugus</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink">The month, not the line.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          A plan is paid a monthly amount for each enrolled person. A vendor bill is checked on the invoice. Nothing here is sent to CMS.
        </p>
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {TABS.map((name) => (
            <button key={name} type="button" onClick={() => setTab(name)} className={tab === name ? "h-10 shrink-0 rounded-full bg-teal px-3 text-sm font-medium text-teal-ink" : "h-10 shrink-0 rounded-full border border-line px-3 text-sm text-ink"}>
              {name}
            </button>
          ))}
        </div>
        {error ? <p className="mt-4 text-sm font-medium text-deep">{error}</p> : null}

        {tab === "Month" ? <Month book={book} lines={lines} total={monthTotal} onBook={save} onError={setError} /> : null}
        {tab === "People" ? (
          <People
            book={book}
            county={county}
            onCounty={setCounty}
            onBook={(next) => {
              setError(null);
              save(next);
            }}
          />
        ) : null}
        {tab === "Meeting" ? <Meet book={book} onBook={save} onError={setError} /> : null}
        {tab === "Day" ? <CenterDay book={book} onBook={save} /> : null}
        {tab === "Rides" ? <Rides book={book} onBook={save} /> : null}
        {tab === "Review" ? <Review book={book} lines={lines} /> : null}
      </main>
    </Shell>
  );
}

function Month({ book, lines, total, onBook, onError }: { book: PaceBook; lines: { person: Person; line: ReturnType<typeof monthLine> }[]; total: number; onBook: (book: PaceBook) => void; onError: (error: string | null) => void }) {
  const [contract, setContract] = useState("");
  const [forCounty, setForCounty] = useState("Cattaraugus");
  return (
    <section className="mt-6">
      <label className="block text-sm font-medium text-ink">
        Center
        <input
          value={book.center}
          onChange={(event) => {
            const next = setCenter(book, event.target.value);
            onError(next.error);
            if (!next.error) onBook(next.book);
          }}
          placeholder="Center name, no member number"
          className="mt-1.5 h-12 w-full rounded-2xl border border-line bg-paper-2 px-4 text-base"
        />
      </label>
      <p className="mt-4 text-sm leading-relaxed text-muted">{RATE_SOURCE}</p>
      <ul className="mt-4 space-y-2">
        {COUNTIES.map((county) => {
          const cents = medicareCents(county, book.year, false);
          return (
            <li key={county} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
              <span className="text-ink">{county}</span>
              <span className="font-medium text-ink tabular-nums">{cents === null ? "Not in the loaded ratebook" : money(cents / 100)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted">
        ESRD in {book.year} is {medicareCents("", book.year, true) === null ? "not loaded" : money((medicareCents("", book.year, true) ?? 0) / 100)}. It replaces the county amount. It is not added on top.
      </p>
      <p className="mt-2 text-sm text-muted">
        The Part D national average bid for 2026 is {money(PART_D_BID[2026] / 100)}. That is not this plan’s payment, so it is not in the month total.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = Math.round(Number(contract) * 100);
          if (!Number.isFinite(cents) || cents <= 0) return;
          onBook({ ...book, medicaid: { ...book.medicaid, [forCounty]: cents } });
          setContract("");
        }}
      >
        <label className="text-sm font-medium text-ink">
          Medicaid contract, {forCounty}
          <input value={contract} onChange={(event) => setContract(event.target.value)} inputMode="decimal" placeholder="You enter it" className="mt-1.5 h-12 w-36 rounded-xl border border-line bg-paper-2 px-3" />
        </label>
        <select value={forCounty} onChange={(event) => setForCounty(event.target.value)} className="h-12 rounded-xl border border-line bg-paper-2 px-3 text-sm">
          {COUNTIES.map((county) => <option key={county}>{county}</option>)}
        </select>
        <button type="submit" className="h-12 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink">Save contract rate</button>
      </form>
      <p className="mt-6 font-display text-3xl text-ink tabular-nums">{money(total / 100)}</p>
      <p className="text-sm text-muted">{enrolledCount(lines)} enrolled for {book.year}. This is a worksheet, not a payment.</p>
      <ul className="mt-3 space-y-2">
        {lines.map(({ person, line }) => (
          <li key={person.id} className="rounded-2xl border border-line px-4 py-3 text-sm">
            <p className="font-medium text-ink">{person.label} · {person.county}</p>
            <p className="text-muted">Medicare {line.medicare === null ? "not loaded" : money(line.medicare / 100)} · Medicaid {line.medicaid === null ? "not entered" : money(line.medicaid / 100)}</p>
            {line.missing.map((item) => <p key={item} className="text-deep">{item}</p>)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function enrolledCount(lines: { person: Person }[]) {
  return lines.length;
}

function People({ book, county, onCounty, onBook }: { book: PaceBook; county: string; onCounty: (county: string) => void; onBook: (book: PaceBook) => void }) {
  return (
    <section className="mt-6">
      <p className="text-sm leading-relaxed text-muted">People are numbered here. Do not type a name, a member number, or a Social Security number. Enrollment needs every gate, including the state’s level-of-care decision.</p>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onBook(addPerson(book, county).book);
        }}
      >
        <label className="text-sm font-medium text-ink">
          County
          <select value={county} onChange={(event) => onCounty(event.target.value)} className="mt-1.5 h-12 rounded-xl border border-line bg-paper-2 px-3">
            {COUNTIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button type="submit" className="h-12 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink">Add a participant</button>
      </form>
      <ul className="mt-4 space-y-3">
        {book.people.map((person) => {
          const gaps = gateGaps(person);
          return (
            <li key={person.id} className="rounded-2xl border border-line px-4 py-3">
              <p className="font-medium text-ink">{person.label}</p>
              <p className="text-sm text-muted">{person.county}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Toggle on={person.medicare} label="Medicare" onClick={() => onBook(patch(book, person.id, { medicare: !person.medicare }))} />
                <Toggle on={person.medicaid} label="Medicaid" onClick={() => onBook(patch(book, person.id, { medicaid: !person.medicaid }))} />
                <Toggle on={person.esrd} label="ESRD" onClick={() => onBook(patch(book, person.id, { esrd: !person.esrd }))} />
                <Toggle on={person.age55} label="55 or older" onClick={() => onBook(patch(book, person.id, { age55: !person.age55 }))} />
                <Toggle on={person.inArea} label="In the service area" onClick={() => onBook(patch(book, person.id, { inArea: !person.inArea }))} />
                <Toggle on={person.voluntary} label="Voluntary" onClick={() => onBook(patch(book, person.id, { voluntary: !person.voluntary }))} />
                <Toggle on={person.community} label="Safe at home" onClick={() => onBook(patch(book, person.id, { community: !person.community }))} />
              </div>
              <label className="mt-2 block text-sm text-ink">
                Level of care
                <select
                  value={person.loc}
                  onChange={(event) => onBook(patch(book, person.id, { loc: event.target.value as Person["loc"] }))}
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-paper-2 px-3"
                >
                  <option value="open">Not reviewed</option>
                  <option value="met">State says the level is met</option>
                  <option value="not">State says the level is not met</option>
                </select>
              </label>
              <p className={gaps.length === 0 ? "mt-2 text-sm text-teal" : "mt-2 text-sm text-deep"}>{gaps.length === 0 ? "Gates are met. Counted in the month." : gaps.join(". ") + "."}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={on ? "h-9 rounded-full bg-teal px-3 text-teal-ink" : "h-9 rounded-full border border-line px-3 text-ink"}>
      {label}
    </button>
  );
}

function patch(book: PaceBook, id: string, change: Partial<Person>): PaceBook {
  return { ...book, people: book.people.map((person) => (person.id === id ? { ...person, ...change } : person)) };
}

function Meet({ book, onBook, onError }: { book: PaceBook; onBook: (book: PaceBook) => void; onError: (error: string | null) => void }) {
  const [present, setPresent] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("2026-10-12");
  const latest = book.meetings[0];
  return (
    <section className="mt-6">
      <p className="text-sm leading-relaxed text-muted">42 CFR 460.102 requires these seats. One person may fill two seats only if they are qualified for both. This list does not record a clinical decision.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SEATS.map((seat) => (
          <button key={seat} type="button" onClick={() => setPresent((current) => current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat])} className={present.includes(seat) ? "h-9 rounded-full bg-teal px-3 text-sm text-teal-ink" : "h-9 rounded-full border border-line px-3 text-sm text-ink"}>
            {seat}
          </button>
        ))}
      </div>
      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const blocked = note.trim() ? setCenter(book, note).error : null;
          if (blocked) {
            onError(blocked);
            return;
          }
          onError(null);
          const meeting: Meeting = { id: crypto.randomUUID(), date, present, note: note.trim() };
          onBook({ ...book, meetings: [meeting, ...book.meetings] });
          setNote("");
        }}
      >
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-paper-2 px-3" />
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="What was decided. No names or numbers." className="w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-base" />
        <button type="submit" className="h-12 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink">Save the meeting</button>
      </form>
      {latest ? <p className="mt-4 text-sm text-deep">{missingSeats(latest.present).length === 0 ? `${latest.date}: every required seat was marked.` : `${latest.date} is missing ${missingSeats(latest.present).join(", ")}.`}</p> : null}
    </section>
  );
}

function CenterDay({ book, onBook }: { book: PaceBook; onBook: (book: PaceBook) => void }) {
  const [date, setDate] = useState("2026-10-12");
  const [present, setPresent] = useState<string[]>([]);
  return (
    <section className="mt-6">
      <p className="text-sm text-muted">Who was in the center that day. This is attendance, not a claim.</p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const day: Day = { id: crypto.randomUUID(), date, present };
          onBook({ ...book, days: [day, ...book.days] });
        }}
      >
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-paper-2 px-3" />
        <div className="flex flex-wrap gap-2">
          {book.people.map((person) => (
            <button key={person.id} type="button" onClick={() => setPresent((current) => current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id])} className={present.includes(person.id) ? "h-9 rounded-full bg-teal px-3 text-sm text-teal-ink" : "h-9 rounded-full border border-line px-3 text-sm text-ink"}>
              {person.label}
            </button>
          ))}
        </div>
        <button type="submit" className="h-12 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink">Save the day</button>
      </form>
      <ul className="mt-4 space-y-2 text-sm text-ink">
        {book.days.map((day) => <li key={day.id}>{day.date}: {day.present.length} in the center</li>)}
      </ul>
    </section>
  );
}

function Rides({ book, onBook }: { book: PaceBook; onBook: (book: PaceBook) => void }) {
  const [date, setDate] = useState("2026-10-12");
  const [personId, setPersonId] = useState(book.people[0]?.id ?? "");
  const [trip, setTrip] = useState<Ride["trip"]>("Center");
  return (
    <section className="mt-6">
      <p className="text-sm text-muted">A ride is Center, Clinic, or Home. No street address.</p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!personId) return;
          const ride: Ride = { id: crypto.randomUUID(), date, personId, trip };
          onBook({ ...book, rides: [ride, ...book.rides] });
        }}
      >
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-paper-2 px-3" />
        <select value={personId} onChange={(event) => setPersonId(event.target.value)} className="h-12 w-full rounded-xl border border-line bg-paper-2 px-3">
          {book.people.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
        </select>
        <select value={trip} onChange={(event) => setTrip(event.target.value as Ride["trip"])} className="h-12 w-full rounded-xl border border-line bg-paper-2 px-3">
          <option>Center</option>
          <option>Clinic</option>
          <option>Home</option>
        </select>
        <button type="submit" className="h-12 rounded-full bg-teal px-4 text-sm font-medium text-teal-ink">Save the ride</button>
      </form>
      <ul className="mt-4 space-y-2 text-sm text-ink">
        {book.rides.map((ride) => <li key={ride.id}>{ride.date}: {book.people.find((person) => person.id === ride.personId)?.label ?? "Participant"} to {ride.trip}</li>)}
      </ul>
    </section>
  );
}

function Review({ book, lines }: { book: PaceBook; lines: { person: Person; line: ReturnType<typeof monthLine> }[] }) {
  const problems = [
    ...book.people.filter((person) => !canEnroll(person)).map((person) => `${person.label} is not enrolled. ${gateGaps(person)[0]}.`),
    ...lines.flatMap(({ person, line }) => line.missing.map((item) => `${person.label}: ${item}`)),
    ...book.meetings.slice(0, 1).flatMap((meeting) => missingSeats(meeting.present).map((seat) => `${meeting.date} meeting is missing ${seat}.`)),
  ];
  return (
    <section className="mt-6">
      <p className="text-sm leading-relaxed text-muted">A person reviews this. The encounter file is the invoice check. This page does not submit enrollment, capitation, or encounter data.</p>
      <Link to="/" className="mt-3 inline-flex h-11 items-center text-sm font-medium text-teal">Check a vendor bill</Link>
      {problems.length === 0 ? <p className="mt-4 text-sm text-teal">Nothing is open on the people you have marked.</p> : (
        <ul className="mt-4 space-y-2 text-sm text-deep">{problems.map((item) => <li key={item}>{item}</li>)}</ul>
      )}
      <button
        type="button"
        className="mt-4 h-12 rounded-full border border-line px-4 text-sm font-medium text-ink"
        onClick={() => {
          const blob = new Blob([JSON.stringify({ sent: false, note: "Review only. Not submitted.", book }, null, 2)], { type: "application/json" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "pace-review.json";
          link.click();
          URL.revokeObjectURL(link.href);
        }}
      >
        Download the review. It is not sent.
      </button>
    </section>
  );
}

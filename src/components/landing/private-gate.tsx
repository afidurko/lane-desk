import { useState, type FormEvent, type ReactNode } from "react";

const KEY = "lane-private-gate";
const CODE = "olean-13282";

export function PrivateGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "open";
  });
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() !== CODE) {
      setWrong(true);
      return;
    }
    window.localStorage.setItem(KEY, "open");
    setOpen(true);
  }

  if (open) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <p className="text-[13px] text-muted">Private</p>
      <h1 className="mt-3 text-[28px] font-bold tracking-tight text-ink tabular-nums">This desk is not public.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Enter the code to view it. Nothing here is published until you say so.
      </p>
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="gate" className="text-sm font-medium text-ink">
          View code
        </label>
        <input
          id="gate"
          type="password"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setWrong(false);
          }}
          className="mt-1.5 h-12 w-full rounded-[10px] bg-paper-2 px-3 text-base text-ink"
        />
        {wrong ? (
          <p className="mt-2 text-sm font-medium text-deep" role="alert">
            That code is not the one.
          </p>
        ) : null}
        <button
          type="submit"
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal text-sm font-medium text-teal-ink"
        >
          Open
        </button>
      </form>
    </main>
  );
}

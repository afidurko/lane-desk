const KEY = "lane-submitter";

export type Submitter = {
  name: string;
  npi: string;
  submitterId: string;
  receiver: string;
};

const EMPTY: Submitter = {
  name: "",
  npi: "",
  submitterId: "",
  receiver: "National Government Services, MAC 13282",
};

export function readSubmitter(): Submitter {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<Submitter>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      npi: typeof parsed.npi === "string" ? parsed.npi : "",
      submitterId: typeof parsed.submitterId === "string" ? parsed.submitterId : "",
      receiver: parsed.receiver || EMPTY.receiver,
    };
  } catch {
    return EMPTY;
  }
}

export function writeSubmitter(submitter: Submitter) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(submitter));
}

export function submitterReady(submitter: Submitter) {
  return submitter.name.trim().length > 1 && /^\d{10}$/.test(submitter.npi) && submitter.submitterId.trim().length > 1;
}

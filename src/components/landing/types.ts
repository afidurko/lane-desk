export const PLANS = ["stopwatch", "parallel", "wrap"] as const;
export type PlanId = (typeof PLANS)[number];

export const ROLES = [
  { id: "coding", label: "Coding lead" },
  { id: "finance", label: "Finance" },
  { id: "clinical", label: "Medical director" },
  { id: "operator", label: "Operator" },
] as const;

export const ENCOUNTERS = [
  { id: "pt", label: "Adult day therapy schedule" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];
export type EncounterId = (typeof ENCOUNTERS)[number]["id"];

export type ProofRequest = {
  email: string;
  role: RoleId;
  encounter: EncounterId;
  plan: PlanId;
  at: string;
};

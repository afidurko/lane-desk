/**
 * Seeded sample notes for the demo. All synthetic: no real person, no real visit.
 * The text only uses wording the rule-based coder already reads. No dollar figure is typed here:
 * every price comes from the loaded fee file when the note is run.
 */
export type Sample = { id: string; label: string; why: string; note: string };

export const SAMPLES: readonly Sample[] = [
  {
    id: "one",
    label: "One service",
    why: "One therapy line, one unit.",
    note: `Participant, adult day health. Synthetic note, not a real person.
Therapeutic exercise, supervised, 15 minutes. One unit.
Gait and balance. No new pain reported.
Plan: continue therapeutic exercise next session.`,
  },
  {
    id: "two",
    label: "Two services",
    why: "Two therapy lines. Medicare cuts the practice-expense part of the second one.",
    note: `Participant, adult day health. Synthetic note, not a real person.
Therapeutic exercise, 15 minutes.
Manual therapy, 15 minutes.
Plan: repeat next session.`,
  },
  {
    id: "units",
    label: "Minutes become units",
    why: "Thirty minutes of one service is two units.",
    note: `Participant, adult day health. Synthetic note, not a real person.
Gait training, 30 minutes.
Plan: continue.`,
  },
  {
    id: "refused",
    label: "A note with an identifier",
    why: "Shows the refusal. Nothing is priced or kept.",
    note: `MRN 000000. Synthetic example of what gets refused.
Therapeutic exercise, 15 minutes.`,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0];

/** Short synthetic notes the Proof screen times. Same wording the coder reads, no identifiers. */
export const PROOF_NOTES: readonly string[] = [
  ...SAMPLES.filter((sample) => sample.id !== "refused").map((sample) => sample.note),
  "Synthetic note. Neuromuscular reeducation, 15 minutes.",
  "Synthetic note. Self-care training, one unit.",
  "Synthetic note. Therapeutic activities, 15 minutes.\nTherapeutic exercise, 15 minutes.",
  "Synthetic note. Group caregiver training.",
];

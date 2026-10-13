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
Exercise for strength and range of motion, supervised, 15 minutes. One unit.
Balance looked steady. No new pain reported.
Plan: continue the same exercise next session.`,
  },
  {
    id: "two",
    label: "Two services",
    why: "Two therapy lines. Medicare cuts the practice-expense part of the second one.",
    note: `Participant, adult day health. Synthetic note, not a real person.
Exercise for strength and range of motion, 15 minutes.
Joint mobilization, 15 minutes.
Plan: repeat next session.`,
  },
  {
    id: "units",
    label: "Minutes become units",
    why: "Thirty minutes of one service is two units.",
    note: `Participant, adult day health. Synthetic note, not a real person.
Walking practice with assist, 30 minutes.
Plan: continue.`,
  },
  {
    id: "day",
    label: "A full therapy day",
    why: "Three units of one service and one of another. Medicare cuts the practice-expense part of every unit after the first.",
    note: `Participant, adult day health. Synthetic note, not a real person.
Exercise for strength and range of motion, 45 minutes.
Walking practice with assist, 15 minutes.
Plan: continue.`,
  },
  {
    id: "refused",
    label: "A note with an identifier",
    why: "Shows the refusal. Nothing is priced or kept.",
    note: `MRN 000000. Synthetic example of what gets refused.
Exercise for strength and range of motion, 15 minutes.`,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0];

/** Short synthetic notes the Proof screen times. Same wording the coder reads, no identifiers. */
export const PROOF_NOTES: readonly string[] = [
  ...SAMPLES.filter((sample) => sample.id !== "refused").map((sample) => sample.note),
  "Synthetic note. Did balance and coordination retraining, 15 minutes.",
  "Synthetic note. Self-care training, one unit.",
  "Synthetic note. Did functional activity practice, 15 minutes.\nExercise for strength and range of motion, 15 minutes.",
  "Synthetic note. Did training for a group of caregivers.",
];

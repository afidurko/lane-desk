export type TherapyCode = {
  code: string;
  name: string;
  unitDollars: number;
  separate: boolean;
  phrases: readonly string[];
};

/**
 * 2026 physical, occupational, and speech therapy.
 * Amounts are Rest of New York, MAC 13282, locality 99, non-facility, non-QP.
 * separate is false when the file status is bundled, not valid, noncovered, restricted, or contractor priced.
 * Wound care, acupuncture, nutrition, scalp cooling, and behavior-assessment codes are not therapy here.
 */
export const THERAPY: readonly TherapyCode[] = [
  { code: "92507", name: "Speech treatment, individual", unitDollars: 74.43, separate: true, phrases: ["individual speech treatment", "speech language treatment"] },
  { code: "92508", name: "Speech treatment, group", unitDollars: 23.31, separate: true, phrases: ["group speech treatment"] },
  { code: "92521", name: "Speech fluency evaluation", unitDollars: 130.26, separate: true, phrases: ["evaluation of speech fluency", "speech fluency evaluation"] },
  { code: "92522", name: "Speech production evaluation", unitDollars: 109.17, separate: true, phrases: ["evaluate speech production", "speech production evaluation"] },
  { code: "92523", name: "Speech sound and language evaluation", unitDollars: 221.47, separate: true, phrases: ["speech sound and language", "speech and language comprehension"] },
  { code: "92524", name: "Voice analysis", unitDollars: 107.04, separate: true, phrases: ["behavioral qualitative analysis of voice", "voice analysis"] },
  { code: "92526", name: "Oral function therapy", unitDollars: 82.12, separate: true, phrases: ["oral function therapy"] },
  { code: "92607", name: "Speech device evaluation", unitDollars: 119.14, separate: true, phrases: ["speech generating device evaluation", "speech device evaluation"] },
  { code: "92608", name: "Speech device evaluation, additional", unitDollars: 46.54, separate: true, phrases: ["additional speech device evaluation"] },
  { code: "92609", name: "Speech device service", unitDollars: 99.84, separate: true, phrases: ["speech device service", "use of speech device"] },
  { code: "92610", name: "Swallowing evaluation", unitDollars: 82.68, separate: true, phrases: ["evaluate swallowing", "swallowing evaluation"] },
  { code: "97010", name: "Hot or cold packs", unitDollars: 0, separate: false, phrases: ["hot or cold packs", "hot packs", "cold packs"] },
  { code: "97012", name: "Mechanical traction", unitDollars: 13.96, separate: true, phrases: ["mechanical traction"] },
  { code: "97014", name: "Electrical stimulation, not valid for Medicare", unitDollars: 0, separate: false, phrases: [] },
  { code: "97016", name: "Vasopneumatic device", unitDollars: 11.64, separate: true, phrases: ["vasopneumatic"] },
  { code: "97018", name: "Paraffin bath", unitDollars: 5.73, separate: true, phrases: ["paraffin bath"] },
  { code: "97022", name: "Whirlpool", unitDollars: 15.11, separate: true, phrases: ["whirlpool therapy"] },
  { code: "97024", name: "Diathermy", unitDollars: 7, separate: true, phrases: ["diathermy", "microwave therapy"] },
  { code: "97026", name: "Infrared", unitDollars: 0, separate: false, phrases: ["infrared therapy"] },
  { code: "97028", name: "Ultraviolet", unitDollars: 7.98, separate: true, phrases: ["ultraviolet therapy"] },
  { code: "97032", name: "Electrical stimulation, attended", unitDollars: 14.3, separate: true, phrases: ["attended electrical stimulation", "attended electric stimulation"] },
  { code: "97033", name: "Iontophoresis", unitDollars: 18.44, separate: true, phrases: ["iontophoresis"] },
  { code: "97034", name: "Contrast bath", unitDollars: 13.6, separate: true, phrases: ["contrast bath"] },
  { code: "97035", name: "Ultrasound", unitDollars: 13.91, separate: true, phrases: ["ultrasound therapy"] },
  { code: "97036", name: "Hubbard tank", unitDollars: 33.39, separate: true, phrases: ["hubbard tank"] },
  { code: "97037", name: "Low level laser", unitDollars: 0, separate: false, phrases: ["low level laser"] },
  { code: "97039", name: "Unlisted modality", unitDollars: 0, separate: false, phrases: ["unlisted modality"] },
  { code: "97110", name: "Therapeutic exercise", unitDollars: 28.27, separate: true, phrases: ["therapeutic exercise", "therapeutic exercises"] },
  { code: "97112", name: "Neuromuscular reeducation", unitDollars: 31.85, separate: true, phrases: ["neuromuscular reeducation", "neuromuscular re-education"] },
  { code: "97113", name: "Aquatic therapy", unitDollars: 35.94, separate: true, phrases: ["aquatic therapy", "aquatic exercise"] },
  { code: "97116", name: "Gait training", unitDollars: 28.27, separate: true, phrases: ["gait training"] },
  { code: "97124", name: "Massage", unitDollars: 28.74, separate: true, phrases: ["massage therapy"] },
  { code: "97129", name: "Cognitive intervention, first", unitDollars: 22.01, separate: true, phrases: ["cognitive function intervention"] },
  { code: "97130", name: "Cognitive intervention, additional", unitDollars: 20.79, separate: true, phrases: ["additional cognitive intervention"] },
  { code: "97139", name: "Unlisted therapeutic procedure", unitDollars: 0, separate: false, phrases: ["unlisted therapeutic procedure"] },
  { code: "97140", name: "Manual therapy", unitDollars: 26.97, separate: true, phrases: ["manual therapy"] },
  { code: "97150", name: "Group therapy", unitDollars: 17.54, separate: true, phrases: ["group therapeutic procedures"] },
  { code: "97161", name: "Physical therapy evaluation, low", unitDollars: 95.46, separate: true, phrases: ["low complexity physical therapy evaluation", "physical therapy evaluation, low"] },
  { code: "97162", name: "Physical therapy evaluation, moderate", unitDollars: 95.46, separate: true, phrases: ["moderate complexity physical therapy evaluation", "physical therapy evaluation, moderate"] },
  { code: "97163", name: "Physical therapy evaluation, high", unitDollars: 95.46, separate: true, phrases: ["high complexity physical therapy evaluation", "physical therapy evaluation, high"] },
  { code: "97164", name: "Physical therapy re-evaluation", unitDollars: 65.62, separate: true, phrases: ["physical therapy re-evaluation", "physical therapy reevaluation"] },
  { code: "97165", name: "Occupational therapy evaluation, low", unitDollars: 98, separate: true, phrases: ["low complexity occupational therapy evaluation", "occupational therapy evaluation, low"] },
  { code: "97166", name: "Occupational therapy evaluation, moderate", unitDollars: 98, separate: true, phrases: ["moderate complexity occupational therapy evaluation", "occupational therapy evaluation, moderate"] },
  { code: "97167", name: "Occupational therapy evaluation, high", unitDollars: 98, separate: true, phrases: ["high complexity occupational therapy evaluation", "occupational therapy evaluation, high"] },
  { code: "97168", name: "Occupational therapy re-evaluation", unitDollars: 66.57, separate: true, phrases: ["occupational therapy re-evaluation", "occupational therapy reevaluation"] },
  { code: "97530", name: "Therapeutic activities", unitDollars: 33.97, separate: true, phrases: ["therapeutic activities"] },
  { code: "97533", name: "Sensory integration", unitDollars: 58.47, separate: true, phrases: ["sensory integration"] },
  { code: "97535", name: "Self-care training", unitDollars: 31.45, separate: true, phrases: ["self-care training", "self care training", "home management training"] },
  { code: "97537", name: "Community or work reintegration", unitDollars: 31.18, separate: true, phrases: ["community reintegration", "work reintegration"] },
  { code: "97542", name: "Wheelchair management", unitDollars: 30.23, separate: true, phrases: ["wheelchair management", "wheelchair training"] },
  { code: "97545", name: "Work hardening", unitDollars: 0, separate: false, phrases: ["work hardening"] },
  { code: "97546", name: "Work hardening, additional", unitDollars: 0, separate: false, phrases: ["work hardening add-on", "additional work hardening"] },
  { code: "97550", name: "Caregiver training", unitDollars: 51.72, separate: true, phrases: ["caregiver training"] },
  { code: "97551", name: "Caregiver training, additional", unitDollars: 25.65, separate: true, phrases: ["additional caregiver training"] },
  { code: "97552", name: "Caregiver training, group", unitDollars: 21.24, separate: true, phrases: ["group caregiver training"] },
  { code: "97750", name: "Physical performance test", unitDollars: 32.72, separate: true, phrases: ["physical performance test"] },
  { code: "97755", name: "Assistive technology assessment", unitDollars: 36.81, separate: true, phrases: ["assistive technology assessment"] },
  { code: "97760", name: "Orthotic training", unitDollars: 44.54, separate: true, phrases: ["orthotic management", "orthotic training"] },
  { code: "97761", name: "Prosthetic training", unitDollars: 39.15, separate: true, phrases: ["prosthetic training"] },
  { code: "97763", name: "Orthotic or prosthetic management, subsequent", unitDollars: 48.32, separate: true, phrases: ["subsequent orthotic", "subsequent prosthetic"] },
  { code: "G0283", name: "Electrical stimulation, unattended", unitDollars: 12.28, separate: true, phrases: ["electrical stimulation", "electric stimulation"] },
];

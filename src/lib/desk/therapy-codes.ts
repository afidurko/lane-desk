import { KEEP_TYPED_NAMES, KEEP_TYPED_NY_AMOUNTS } from "@/lib/config/mode";
import { NY_UNIT_DOLLARS } from "@/lib/desk/therapy-ny-rates";
import { THERAPY_NAMES } from "@/lib/desk/therapy-names";
import { NEAR_DESCRIPTOR_BY_CODE } from "@/lib/config/internal-only";

export type TherapyCode = {
  code: string;
  name: string;
  unitDollars: number;
  separate: boolean;
  phrases: readonly string[];
};

/**
 * 2026 physical, occupational, and speech therapy.
 * Amounts are the internal New York locality table (internal build only; see therapy-ny-rates.ts).
 * separate is false when the file status is bundled, not valid, noncovered, restricted, or contractor priced.
 * Wound care, acupuncture, nutrition, scalp cooling, and behavior-assessment codes are not therapy here.
 */
/**
 * Note matchers. `plain` is everyday wording and ships in every build. `nearDescriptor` is wording close to a CPT
 * descriptor; it lives in internal-only.ts and is empty in a public build, so a public bundle never maps a code
 * to near-descriptor text.
 */
function publicSafe(code: string, plain: readonly string[]): readonly string[] {
  return [...plain, ...(NEAR_DESCRIPTOR_BY_CODE[code] ?? [])];
}

/** Every near-descriptor matcher (checks only: a public sample note must not rely on one). */
export const NEAR_DESCRIPTOR_PHRASES: readonly string[] = Object.values(NEAR_DESCRIPTOR_BY_CODE).flat();

const TABLE: readonly TherapyCode[] = [
  { code: "92507", name: "", unitDollars: 0, separate: true, phrases: ["individual speech treatment", "speech language treatment"] },
  { code: "92508", name: "", unitDollars: 0, separate: true, phrases: ["group speech treatment"] },
  { code: "92521", name: "", unitDollars: 0, separate: true, phrases: ["evaluation of speech fluency", "speech fluency evaluation"] },
  { code: "92522", name: "", unitDollars: 0, separate: true, phrases: ["evaluate speech production", "speech production evaluation"] },
  { code: "92523", name: "", unitDollars: 0, separate: true, phrases: ["speech sound and language", "speech and language comprehension"] },
  { code: "92524", name: "", unitDollars: 0, separate: true, phrases: ["behavioral qualitative analysis of voice", "voice analysis"] },
  { code: "92526", name: "", unitDollars: 0, separate: true, phrases: ["oral function therapy"] },
  { code: "92607", name: "", unitDollars: 0, separate: true, phrases: ["speech generating device evaluation", "speech device evaluation"] },
  { code: "92608", name: "", unitDollars: 0, separate: true, phrases: ["additional speech device evaluation"] },
  { code: "92609", name: "", unitDollars: 0, separate: true, phrases: ["speech device service", "use of speech device"] },
  { code: "92610", name: "", unitDollars: 0, separate: true, phrases: ["evaluate swallowing", "swallowing evaluation"] },
  { code: "97010", name: "", unitDollars: 0, separate: false, phrases: ["hot or cold packs", "hot packs", "cold packs"] },
  { code: "97012", name: "", unitDollars: 0, separate: true, phrases: ["mechanical traction"] },
  { code: "97014", name: "", unitDollars: 0, separate: false, phrases: [] },
  { code: "97016", name: "", unitDollars: 0, separate: true, phrases: ["vasopneumatic"] },
  { code: "97018", name: "", unitDollars: 0, separate: true, phrases: ["paraffin bath"] },
  { code: "97022", name: "", unitDollars: 0, separate: true, phrases: ["whirlpool therapy"] },
  { code: "97024", name: "", unitDollars: 0, separate: true, phrases: ["diathermy", "microwave therapy"] },
  { code: "97026", name: "", unitDollars: 0, separate: true, phrases: ["infrared therapy"] },
  { code: "97028", name: "", unitDollars: 0, separate: true, phrases: ["ultraviolet therapy"] },
  { code: "97032", name: "", unitDollars: 0, separate: true, phrases: ["attended electrical stimulation", "attended electric stimulation"] },
  { code: "97033", name: "", unitDollars: 0, separate: true, phrases: ["iontophoresis"] },
  { code: "97034", name: "", unitDollars: 0, separate: true, phrases: ["contrast bath"] },
  { code: "97035", name: "", unitDollars: 0, separate: true, phrases: ["ultrasound therapy"] },
  { code: "97036", name: "", unitDollars: 0, separate: true, phrases: ["hubbard tank"] },
  { code: "97037", name: "", unitDollars: 0, separate: false, phrases: ["low level laser"] },
  { code: "97039", name: "", unitDollars: 0, separate: false, phrases: ["unlisted modality"] },
  { code: "97110", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97110", ["exercise for strength and range of motion", "strength and range of motion exercise"]) },
  { code: "97112", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97112", ["balance and coordination retraining"]) },
  { code: "97113", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97113", ["exercise in the pool"]) },
  { code: "97116", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97116", ["walking practice"]) },
  { code: "97124", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97124", ["soft tissue massage"]) },
  { code: "97129", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97129", ["memory and attention retraining"]) },
  { code: "97130", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97130", []) },
  { code: "97139", name: "", unitDollars: 0, separate: false, phrases: publicSafe("97139", []) },
  { code: "97140", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97140", ["joint mobilization"]) },
  { code: "97150", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97150", ["therapy in a group"]) },
  { code: "97161", name: "", unitDollars: 0, separate: true, phrases: ["low complexity physical therapy evaluation", "physical therapy evaluation, low"] },
  { code: "97162", name: "", unitDollars: 0, separate: true, phrases: ["moderate complexity physical therapy evaluation", "physical therapy evaluation, moderate"] },
  { code: "97163", name: "", unitDollars: 0, separate: true, phrases: ["high complexity physical therapy evaluation", "physical therapy evaluation, high"] },
  { code: "97164", name: "", unitDollars: 0, separate: true, phrases: ["physical therapy re-evaluation", "physical therapy reevaluation"] },
  { code: "97165", name: "", unitDollars: 0, separate: true, phrases: ["low complexity occupational therapy evaluation", "occupational therapy evaluation, low"] },
  { code: "97166", name: "", unitDollars: 0, separate: true, phrases: ["moderate complexity occupational therapy evaluation", "occupational therapy evaluation, moderate"] },
  { code: "97167", name: "", unitDollars: 0, separate: true, phrases: ["high complexity occupational therapy evaluation", "occupational therapy evaluation, high"] },
  { code: "97168", name: "", unitDollars: 0, separate: true, phrases: ["occupational therapy re-evaluation", "occupational therapy reevaluation"] },
  { code: "97530", name: "", unitDollars: 0, separate: true, phrases: publicSafe("97530", ["functional activity practice"]) },
  { code: "97533", name: "", unitDollars: 0, separate: true, phrases: ["sensory integration"] },
  { code: "97535", name: "", unitDollars: 0, separate: true, phrases: ["self-care training", "self care training", "home management training"] },
  { code: "97537", name: "", unitDollars: 0, separate: true, phrases: ["community reintegration", "work reintegration"] },
  { code: "97542", name: "", unitDollars: 0, separate: true, phrases: ["wheelchair management", "wheelchair training"] },
  { code: "97545", name: "", unitDollars: 0, separate: false, phrases: ["work hardening"] },
  { code: "97546", name: "", unitDollars: 0, separate: false, phrases: ["work hardening add-on", "additional work hardening"] },
  { code: "97550", name: "", unitDollars: 0, separate: true, phrases: ["caregiver training"] },
  { code: "97551", name: "", unitDollars: 0, separate: true, phrases: ["additional caregiver training"] },
  { code: "97552", name: "", unitDollars: 0, separate: true, phrases: ["group caregiver training"] },
  { code: "97750", name: "", unitDollars: 0, separate: true, phrases: ["physical performance test"] },
  { code: "97755", name: "", unitDollars: 0, separate: true, phrases: ["assistive technology assessment"] },
  { code: "97760", name: "", unitDollars: 0, separate: true, phrases: ["orthotic management", "orthotic training"] },
  { code: "97761", name: "", unitDollars: 0, separate: true, phrases: ["prosthetic training"] },
  { code: "97763", name: "", unitDollars: 0, separate: true, phrases: ["subsequent orthotic", "subsequent prosthetic"] },
  { code: "G0283", name: "", unitDollars: 0, separate: true, phrases: ["electrical stimulation", "electric stimulation"] },
];

/**
 * Amounts are filled in only when the build keeps typed Rest of New York figures. A public build ships zeros.
 * Names are filled in only in an internal build: many match the CMS short descriptions, which are CPT text.
 * A public build ships no names and shows the code number.
 */
export const THERAPY: readonly TherapyCode[] = TABLE.map((item) => ({
  ...item,
  name: KEEP_TYPED_NAMES ? (THERAPY_NAMES[item.code] ?? "") : "",
  unitDollars: KEEP_TYPED_NY_AMOUNTS ? (NY_UNIT_DOLLARS[item.code] ?? 0) : 0,
}));

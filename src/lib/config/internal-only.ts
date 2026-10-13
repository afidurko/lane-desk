/**
 * Internal-only constants. Each value is chosen by the build-time constant in THIS module, so a public build
 * folds the literal away and these strings never reach a public bundle (cross-module constants are not always
 * folded). check:output fails if any of them ships. Under plain node (checks) the internal values are kept.
 */
declare const __DEMO_MODE__: string | undefined;
const KEEP: boolean = typeof __DEMO_MODE__ !== "undefined" ? __DEMO_MODE__ === "internal" : true;

export const INTERNAL_DEFAULT_LOCALITY: { mac: string; number: string; key: string; name: string } = KEEP
  ? { mac: "13282", number: "99", key: "13282/99", name: "Rest of New York" }
  : { mac: "", number: "", key: "national", name: "National" };

export const INTERNAL_SCOPE_LABEL: string = KEEP ? "Rest of New York, MAC 13282, locality 99, non-facility" : "";

export const INTERNAL_SCHEDULE_SETTING: string = KEEP ? "Rest of New York, MAC 13282, locality 99, non-facility, non-QP" : "";

/**
 * Note matchers by code whose wording is close to, or equals, a CMS 2026 short descriptor (CPT text, AMA license).
 * Empty in a public build. check:output fails if any 2026 short descriptor ships.
 */
export const NEAR_DESCRIPTOR_BY_CODE: Readonly<Record<string, readonly string[]>> = KEEP
  ? {
      "92521": ["evaluation of speech fluency"],
      "92522": ["evaluate speech production"],
      "92526": ["oral function therapy"],
      "97018": ["paraffin bath"],
      "97022": ["whirlpool therapy"],
      "97026": ["infrared therapy"],
      "97028": ["ultraviolet therapy"],
      "97039": ["unlisted modality"],
      "97110": ["therapeutic exercise", "therapeutic exercises"],
      "97112": ["neuromuscular reeducation", "neuromuscular re-education"],
      "97113": ["aquatic therapy", "aquatic exercise"],
      "97116": ["gait training"],
      "97124": ["massage therapy"],
      "97129": ["cognitive function intervention"],
      "97130": ["additional cognitive intervention"],
      "97139": ["unlisted therapeutic procedure"],
      "97140": ["manual therapy"],
      "97150": ["group therapeutic procedures"],
      "97530": ["therapeutic activities"],
      "97533": ["sensory integration"],
      "97545": ["work hardening"],
      "97546": ["work hardening add-on", "additional work hardening"],
      "97552": ["group caregiver training"],
      "97750": ["physical performance test"],
      "97755": ["assistive technology assessment"],
    }
  : {};

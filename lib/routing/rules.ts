/**
 * Deterministic license-type routing rules.
 *
 * Thresholds below reflect general, publicly available guidance on Maine DMR
 * aquaculture license categories (LPA vs. Experimental vs. Standard leases)
 * as of this writing. DMR rules and size/term limits are subject to change —
 * treat routing output as a *preliminary* recommendation, not a final
 * determination, and confirm current requirements against DMR's own
 * documentation (see the Regulatory Q&A feature) or the Department directly.
 */
import { EMPTY_PROFILE, LicenseType, type OperationProfile, type RoutingResult } from "./schema";

const SQ_FT_PER_ACRE = 43_560;

export const LPA_MAX_AREA_SQ_FT = 400;
export const EXPERIMENTAL_MAX_AREA_SQ_FT = 4 * SQ_FT_PER_ACRE;
export const EXPERIMENTAL_MAX_DURATION_YEARS = 3;
export const STANDARD_LEASE_MAX_DURATION_YEARS = 20;

export const REQUIRED_FIELDS: (keyof OperationProfile)[] = [
  "species",
  "gearType",
  "siteAreaSqFt",
  "leaseDurationYears",
];

export const FIELD_PROMPTS: Record<string, string> = {
  species: "which species you plan to cultivate (e.g. oysters, mussels, kelp)",
  gearType:
    "what gear or cultivation method you'll use (e.g. suspended cages, bottom culture, floating rafts)",
  siteAreaSqFt: "roughly how large the proposed site is (in square feet or acres)",
  leaseDurationYears: "how long a lease term you're looking for",
};

export function missingRequiredFields(profile: OperationProfile): (keyof OperationProfile)[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = profile[field];
    return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
  });
}

export function route(profile: OperationProfile): RoutingResult {
  const missing = missingRequiredFields(profile);
  if (missing.length > 0) {
    return {
      licenseType: LicenseType.UNDETERMINED,
      rationale: "Not enough information yet to recommend a license type.",
      missingFields: missing,
      incompatibilityWarning: null,
    };
  }

  const area = profile.siteAreaSqFt!;
  const duration = profile.leaseDurationYears!;
  const wantsTrial = Boolean(profile.wantsToTestBeforeCommitting);

  let incompatibilityWarning: string | null = null;
  if (duration > STANDARD_LEASE_MAX_DURATION_YEARS) {
    incompatibilityWarning =
      `A ${duration}-year term exceeds the typical ${STANDARD_LEASE_MAX_DURATION_YEARS}-year ` +
      "maximum for a Maine DMR standard aquaculture lease — confirm the current maximum " +
      "term with DMR before applying.";
  }

  if (area <= LPA_MAX_AREA_SQ_FT && !wantsTrial) {
    return {
      licenseType: LicenseType.LIMITED_PURPOSE_AQUACULTURE,
      rationale:
        `A site of ${area.toFixed(0)} sq ft falls within the LPA size threshold ` +
        `(${LPA_MAX_AREA_SQ_FT} sq ft), and this isn't described as a trial run. ` +
        "LPA licenses are lower-cost, faster to obtain, and renewed annually, but " +
        "are capped in size and don't require the riparian-owner notification and " +
        "public-hearing process a lease does.",
      missingFields: [],
      incompatibilityWarning,
    };
  }

  if (area <= EXPERIMENTAL_MAX_AREA_SQ_FT && (wantsTrial || duration <= EXPERIMENTAL_MAX_DURATION_YEARS)) {
    return {
      licenseType: LicenseType.EXPERIMENTAL_LEASE,
      rationale:
        `A site of ${area.toFixed(0)} sq ft is within the experimental lease size threshold ` +
        `(${EXPERIMENTAL_MAX_AREA_SQ_FT.toFixed(0)} sq ft / 4 acres), and ` +
        (wantsTrial
          ? "you've described this as testing a site, species, or technique before committing long-term."
          : `a ${duration}-year term fits an experimental lease's shorter horizon.`) +
        " Experimental leases are meant for exactly this kind of trial before " +
        "committing to a standard lease.",
      missingFields: [],
      incompatibilityWarning,
    };
  }

  return {
    licenseType: LicenseType.STANDARD_LEASE,
    rationale:
      `A site of ${area.toFixed(0)} sq ft and a ${duration}-year term exceed the LPA and ` +
      "experimental lease thresholds, which points to a standard aquaculture lease — " +
      "Maine's long-term license for established commercial-scale operations. This is " +
      "the most involved application: expect riparian landowner notification, a tax " +
      "map, and a public scoping process.",
    missingFields: [],
    incompatibilityWarning,
  };
}

export const UNDETERMINED_ROUTING: RoutingResult = route(EMPTY_PROFILE);

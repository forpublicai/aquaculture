import { z } from "zod";

export const LicenseType = {
  LIMITED_PURPOSE_AQUACULTURE: "Limited Purpose Aquaculture (LPA) License",
  EXPERIMENTAL_LEASE: "Experimental Lease",
  STANDARD_LEASE: "Standard Lease",
  UNDETERMINED: "Undetermined — more information needed",
} as const;

export type LicenseType = (typeof LicenseType)[keyof typeof LicenseType];

/**
 * Fields extracted from the applicant's natural-language description of
 * their (prospective) operation. All fields are individually optional since
 * they're filled in incrementally over the conversation — see
 * REQUIRED_FIELDS in rules.ts for what's needed before routing.
 */
export const OperationProfileSchema = z.object({
  species: z
    .array(z.string())
    .nullable()
    .describe("Species to be cultivated, e.g. ['oysters'], ['kelp', 'mussels']."),
  gearType: z
    .string()
    .nullable()
    .describe(
      "Cultivation method/gear, e.g. 'suspended cages', 'bottom culture', 'floating rafts', 'longlines'."
    ),
  siteAreaSqFt: z
    .number()
    .nullable()
    .describe(
      "Proposed site area in square feet. Convert acres to sq ft if given (1 acre = 43,560 sq ft)."
    ),
  leaseDurationYears: z
    .number()
    .nullable()
    .describe("Desired lease term in years."),
  isFirstTimeApplicant: z
    .boolean()
    .nullable()
    .describe("Whether this is the applicant's first Maine aquaculture license."),
  wantsToTestBeforeCommitting: z
    .boolean()
    .nullable()
    .describe(
      "Whether the applicant wants to trial a new site, species, or technique before committing to a long-term lease."
    ),
  locationDescription: z
    .string()
    .nullable()
    .describe("Free-text description of the proposed site location."),
});

export type OperationProfile = z.infer<typeof OperationProfileSchema>;

export const EMPTY_PROFILE: OperationProfile = {
  species: null,
  gearType: null,
  siteAreaSqFt: null,
  leaseDurationYears: null,
  isFirstTimeApplicant: null,
  wantsToTestBeforeCommitting: null,
  locationDescription: null,
};

export interface RoutingResult {
  licenseType: LicenseType;
  rationale: string;
  missingFields: (keyof OperationProfile)[];
  incompatibilityWarning: string | null;
}

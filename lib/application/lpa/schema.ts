/**
 * The Limited Purpose Aquaculture (LPA) license application, as data.
 *
 * Modeled field-for-field on DMR's joint DMR/ACOE application form,
 * rev. 03/17/2026 (data/knowledge_base/LPA_Application.pdf). Section names and
 * ordering below follow the printed form so a reviewer can hold the two side by
 * side.
 *
 * Two shapes live here:
 *
 * - `LpaFormSchema` — every question the form asks that a person can answer in
 *   conversation. This is what the model extracts into, so every field is
 *   nullable: the application is filled in gradually over many turns, and
 *   "not asked yet" has to be representable.
 * - `LpaApplicationSchema` — the form plus `externalRequirements`, the tracker
 *   for the things the app *cannot* produce (maps, drawings, signatures,
 *   certified mailings). Those are never model-extracted; the applicant marks
 *   them off themselves. Keeping them out of `LpaFormSchema` is what stops the
 *   extraction step from ever inventing a signature it doesn't have.
 *
 * Field descriptions are written for the extraction model, not for the UI —
 * human-facing labels and questions live in ./fields.ts.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Enumerations taken from the form's checkbox lists                           */
/* -------------------------------------------------------------------------- */

export const PaymentType = z.enum(["check", "credit_card"]);

export const SitePurpose = z.enum(["commercial", "recreational", "scientific", "educational"]);

/** Owner/operator exemptions, from the form's "Designating Assistants" page. */
export const OwnerOperatorExemption = z.enum([
  "none",
  "lease_in_own_name",
  "ownership_interest_50_plus",
  "applied_for_lease_own_name",
  "ownership_interest_in_applicant_company",
  "upweller_only",
]);

/** The ten gear categories the form asks you to check. */
export const GearCategory = z.enum([
  "no_gear_bottom_culture",
  "upweller",
  "shellfish_rafts",
  "tray_racks_and_overwintering_cages",
  "soft_or_semi_rigid_bags_or_floating_trays",
  "lantern_or_pearl_nets",
  "scallop_spat_collector_bags",
  "scallop_ear_hangers",
  "marine_algae_gear",
  "bottom_anti_predator_netting",
]);

/**
 * Gear that floats at or near the surface and can host roosting birds. Drives
 * the bird-deterrence narrative the National Shellfish Sanitation Program
 * requires for suspended shellfish culture (form page 12).
 */
export const SUSPENDED_SHELLFISH_GEAR: readonly z.infer<typeof GearCategory>[] = [
  "shellfish_rafts",
  "tray_racks_and_overwintering_cages",
  "soft_or_semi_rigid_bags_or_floating_trays",
  "lantern_or_pearl_nets",
  "scallop_spat_collector_bags",
];

/** Features the form asks you to flag if they're within 1,000 feet of the site. */
export const NearbyFeature = z.enum([
  "federal_navigation_project_or_anchorage",
  "navigational_channel",
  "structures",
  "aquaculture_leases_or_lpas",
  "anchorages_or_moorings",
  "state_or_federal_beach",
  "docking_facility",
]);

/* -------------------------------------------------------------------------- */
/* Repeating sub-structures                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One block of the "Existing Uses" section. The form asks the same five
 * questions about commercial fishing, recreational fishing, boating, and other
 * water-related uses, so the shape is defined once and used four times.
 */
export const UseObservationSchema = z.object({
  activityTypes: z.string().nullable().describe("What kind of activity occurs in the area."),
  seasons: z.string().nullable().describe("Which season(s) the activity occurs in."),
  frequency: z.string().nullable().describe("How frequently the activity occurs."),
  occursWithinSite: z
    .string()
    .nullable()
    .describe(
      "Whether the activity occurs inside the proposed site boundaries; if not, where it occurs relative to the site (e.g. '150 feet to the west')."
    ),
  anticipatedImpacts: z
    .string()
    .nullable()
    .describe("Impacts the applicant anticipates their site having on this activity."),
});

export type UseObservation = z.infer<typeof UseObservationSchema>;

export const EMPTY_USE_OBSERVATION: UseObservation = {
  activityTypes: null,
  seasons: null,
  frequency: null,
  occursWithinSite: null,
  anticipatedImpacts: null,
};

/** A species sourced from a DMR-approved hatchery or the non-shellfish stock list. */
export const HatcheryStockSchema = z.object({
  species: z.string().describe("Common name of the species, e.g. 'American/eastern oyster'."),
  hatcheryName: z.string().nullable().describe("Name of the DMR-approved hatchery or facility."),
  hatcheryAddress: z.string().nullable(),
  hatcheryPhone: z.string().nullable(),
});

/** A species sourced from wild stock or another aquaculture site. */
export const WildStockSchema = z.object({
  species: z.string(),
  waterbody: z.string().nullable().describe("Waterbody the organisms are harvested from."),
  healthZone: z
    .string()
    .nullable()
    .describe("Health zone of the source; must match the LPA site's health zone."),
  harvesterName: z.string().nullable().describe("Full name of the licensed harvester."),
  harvesterLicenseNumber: z.string().nullable(),
  aquacultureSiteId: z.string().nullable().describe("Source aquaculture site ID, if applicable."),
});

/** One row of the gear table. Every item, including lines and moorings, is listed. */
export const GearItemSchema = z.object({
  description: z.string().describe("Specific gear type, e.g. 'soft mesh bags', 'granite mooring'."),
  maximumNumber: z
    .number()
    .nullable()
    .describe("Maximum number of this item to be used at once."),
  dimensions: z.string().nullable().describe("Dimensions of a single unit, e.g. '16\"x20\"x2\"'."),
  datesInWater: z.string().nullable().describe("Dates the gear will be in the water."),
});

/** A feature within 1,000 feet, paired with the applicant's impact assessment. */
export const NearbyFeatureImpactSchema = z.object({
  feature: NearbyFeature,
  impact: z.string().nullable().describe("How the proposed site will impact this feature."),
});

/** One parcel on the certified riparian landowner list. */
export const RiparianLandownerSchema = z.object({
  taxMapNumber: z.string().nullable(),
  lotNumber: z.string().nullable(),
  ownerName: z.string(),
  mailingAddress: z.string().nullable().describe("Mailing address from municipal tax records."),
});

/* -------------------------------------------------------------------------- */
/* The form itself                                                             */
/* -------------------------------------------------------------------------- */

export const LpaFormSchema = z.object({
  /* --- Applicant information (form page 1) --- */
  applicantName: z.string().nullable().describe("Full name of the applicant."),
  applicantAddress: z.string().nullable().describe("Street address, without city/state/zip."),
  applicantCity: z.string().nullable(),
  applicantStateZip: z.string().nullable().describe("State and ZIP code, e.g. 'ME 04841'."),
  applicantTelephone: z.string().nullable(),
  applicantEmail: z
    .string()
    .nullable()
    .describe("Primary contact email. DMR uses email as its main means of contact."),
  applicantDateOfBirth: z
    .string()
    .nullable()
    .describe("Date of birth as YYYY-MM-DD. Applicants must be at least 12 years old."),
  isMaineResident: z
    .boolean()
    .nullable()
    .describe(
      "Whether the applicant is a Maine resident as defined on the form (Maine voter registration, driver's license, vehicle registration, or income tax return). Determines the $100 vs $400 fee."
    ),
  hasPreviouslyAppliedForSite: z
    .boolean()
    .nullable()
    .describe("Whether this is an application for a site previously applied for."),
  previousLpaAcronyms: z
    .array(z.string())
    .nullable()
    .describe("Previous LPA acronyms, if this site was applied for before."),
  paymentType: PaymentType.nullable().describe("How the application fee will be paid."),

  /* --- Existing aquaculture activities (form page 1) --- */
  isAssistantOnOtherLpas: z
    .boolean()
    .nullable()
    .describe("Whether the applicant is listed as an assistant on any existing LPA licenses."),
  assistantLpaAcronyms: z.array(z.string()).nullable(),
  holdsOtherLpaLicenses: z
    .boolean()
    .nullable()
    .describe("Whether the applicant currently holds other LPA licenses (limit is four)."),
  otherLpaAcronyms: z.array(z.string()).nullable(),

  /* --- Designating assistants and owner/operator exemption (form page 2) --- */
  assistantNames: z
    .array(z.string())
    .nullable()
    .describe("Up to three unlicensed assistants. Empty array if none are being designated."),
  primaryAssistantName: z
    .string()
    .nullable()
    .describe("Assistant designated to supervise licensed activity when the holder is absent."),
  primaryAssistantEmail: z.string().nullable(),
  ownerOperatorExemption: OwnerOperatorExemption.nullable().describe(
    "Which owner/operator exemption the applicant claims, or 'none'."
  ),
  exemptionLeaseAcronym: z.string().nullable().describe("Lease acronym supporting the exemption."),
  exemptionCompanyName: z.string().nullable(),
  exemptionOwnershipPercent: z.number().nullable().describe("Ownership percentage, 0-100."),

  /* --- Location of license site (form page 3) --- */
  town: z.string().nullable().describe("Municipality the site is located in."),
  county: z.string().nullable(),
  waterbody: z.string().nullable(),
  siteDescription: z
    .string()
    .nullable()
    .describe("Additional description of where the site is, e.g. 'south of Hog Island'."),
  latitude: z
    .number()
    .nullable()
    .describe("Decimal degrees north of the site's center point, e.g. 43.123456."),
  longitude: z
    .number()
    .nullable()
    .describe("Decimal degrees of the site's center point, negative for west, e.g. -69.123456."),
  lpaHealthZone: z.string().nullable().describe("DMR LPA health zone the site falls in."),
  isAboveMeanLowWater: z
    .boolean()
    .nullable()
    .describe("Whether the site is above mean low water, i.e. intertidal."),
  isAboveExtremeLowWater: z
    .boolean()
    .nullable()
    .describe("Whether the site is above extreme low water / in five feet of water or less at MLW."),
  isMarinaOrPoundSite: z
    .boolean()
    .nullable()
    .describe(
      "Whether the site sits in a marina slip, lobster pound, or similar enclosed site controlled by an entity that can restrict access. Exempts the site from riparian notification and the density standard."
    ),
  municipalityHasHarbormaster: z
    .boolean()
    .nullable()
    .describe("Whether the municipality is served by a harbormaster."),
  purpose: SitePurpose.nullable().describe("Purpose of the operation."),

  /* --- Water quality classification (form page 3) --- */
  growingAreaDesignation: z
    .string()
    .nullable()
    .describe("DMR growing area designation, e.g. 'WA(A)' or 'WA(P1)'."),
  isInRestrictedOrProhibitedArea: z
    .boolean()
    .nullable()
    .describe("Whether the site is in a prohibited, restricted, or conditionally restricted area."),
  restrictedAreaRequirementsAcknowledged: z
    .boolean()
    .nullable()
    .describe("Whether the applicant confirms understanding of the seed-only restrictions."),
  associatedLeaseSiteIds: z
    .array(z.string())
    .nullable()
    .describe("Lease site IDs and holders backing a seed-only site in a restricted area."),

  /* --- Species and source of stock (form pages 4-5) --- */
  hatcheryStock: z.array(HatcheryStockSchema).nullable(),
  wildStock: z.array(WildStockSchema).nullable(),
  wildTakeComplianceAcknowledged: z
    .boolean()
    .nullable()
    .describe("Certification that wild-collected organisms comply with take laws and health zones."),
  scallopAdductorOnlyAcknowledged: z
    .boolean()
    .nullable()
    .describe("Certification that cultured scallops are adductor-only. Scallop sites only."),

  /* --- Site characteristics (form page 6) --- */
  uplandsDescription: z
    .string()
    .nullable()
    .describe("Surrounding uplands, e.g. forested, residential, farmland, commercial."),
  bottomCharacteristics: z
    .string()
    .nullable()
    .describe("Substrate description including flora and fauna."),
  depthAtMeanLowWaterFt: z.number().nullable(),
  depthAtMeanHighWaterFt: z.number().nullable(),
  isInEssentialHabitat: z
    .boolean()
    .nullable()
    .describe("Whether the site is within MDIFW-designated Essential Habitat."),
  hasEagleNestWithin660Ft: z.boolean().nullable(),
  eelgrassDescription: z
    .string()
    .nullable()
    .describe("Eelgrass beds on or near the site, their location and distance. 'None' if absent."),
  eelgrassObservedMonth: z.string().nullable(),
  eelgrassObservedYear: z.number().nullable(),

  /* --- Existing uses (form pages 6-7) --- */
  commercialFishingUse: UseObservationSchema.nullable(),
  recreationalFishingUse: UseObservationSchema.nullable(),
  boatingUse: UseObservationSchema.nullable(),
  otherWaterUse: UseObservationSchema.nullable(),

  /* --- Vicinity map features within 1,000 feet (form pages 8-9) --- */
  hasNoNearbyFeatures: z
    .boolean()
    .nullable()
    .describe("True if the applicant certifies nothing on the list is within 1,000 feet."),
  nearbyFeatures: z.array(NearbyFeatureImpactSchema).nullable(),

  /* --- Gear (form pages 10-11) --- */
  gearCategories: z.array(GearCategory).nullable(),
  gearItems: z
    .array(GearItemSchema)
    .nullable()
    .describe("Every gear item including lines and moorings."),
  gearLayoutWidthFt: z
    .number()
    .nullable()
    .describe("Width of the maximum gear layout in whole feet, at least 1."),
  gearLayoutLengthFt: z
    .number()
    .nullable()
    .describe("Length of the maximum gear layout in whole feet, at least 1."),
  mooringDescription: z
    .string()
    .nullable()
    .describe("Moorings and tackle: mooring type, bottom tackle, line, etc."),
  seasonalGearChanges: z
    .string()
    .nullable()
    .describe("Seasonal changes to gear deployment, or a statement that there are none."),

  /* --- Bird deterrence, suspended shellfish culture only (form page 12) --- */
  birdDeterrenceMeasures: z
    .string()
    .nullable()
    .describe("Measures to deter roosting birds and mitigate pollution from bird waste."),

  /* --- Riparian notification (form pages 16-18) --- */
  hasShorefrontWithin300Ft: z
    .boolean()
    .nullable()
    .describe(
      "Whether any shorefront land, including intertidal and state/federal land, lies within 300 feet of the site."
    ),
  riparianMunicipality: z
    .string()
    .nullable()
    .describe("Municipality that will certify the riparian landowner list."),
  riparianLandowners: z.array(RiparianLandownerSchema).nullable(),
});

export type LpaForm = z.infer<typeof LpaFormSchema>;
export type LpaFormKey = keyof LpaForm;

/* -------------------------------------------------------------------------- */
/* External requirements — the parts the app can't do for you                   */
/* -------------------------------------------------------------------------- */

export const RequirementStatus = z.enum(["not_started", "in_progress", "done", "not_applicable"]);
export type RequirementStatus = z.infer<typeof RequirementStatus>;

export const LpaApplicationSchema = LpaFormSchema.extend({
  /**
   * Status per requirement id (see ./requirements.ts). A missing key means
   * "not_started"; nothing here is ever filled in by the model, only by the
   * applicant, because the app has no way to know whether a harbormaster has
   * actually signed anything.
   */
  externalRequirements: z.record(z.string(), RequirementStatus),

  /**
   * The field key of an outstanding plausibility question, if the applicant has
   * been asked to confirm something that looked wrong (see ./plausibility.ts).
   *
   * This exists so their reply gets recorded against the right field. Without
   * it, answering "no, I meant Cumberland" would be extracted into whichever
   * section the interview had already moved on to.
   */
  pendingConcern: z.string().nullable(),
});

export type LpaApplication = z.infer<typeof LpaApplicationSchema>;

/** Every form field, unanswered. The starting point for a new application. */
export const EMPTY_LPA_APPLICATION: LpaApplication = {
  ...(Object.fromEntries(
    Object.keys(LpaFormSchema.shape).map((key) => [key, null])
  ) as unknown as LpaForm),
  externalRequirements: {},
  pendingConcern: null,
};

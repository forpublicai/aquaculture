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

import { RequirementStatus } from "../definition";

/* -------------------------------------------------------------------------- */
/* Enumerations taken from the form's checkbox lists                           */
/* -------------------------------------------------------------------------- */

export const PaymentType = z.enum(["check", "credit_card"]);

/**
 * Every enum below carries a glossary.
 *
 * The extraction model is shown the allowed values as bare identifiers, and is
 * told (rightly) not to guess. Given a choice between `lease_in_own_name` and
 * `applied_for_lease_own_name` with nothing to distinguish them, the honest
 * answer is null, which leaves the field unanswered and the interview asking the
 * same question again. Spelling out what each value means is what makes mapping
 * plain English onto them possible.
 */
const PAYMENT_TYPE_VALUES =
  "'check': a check is enclosed with the application. " +
  "'credit_card': DMR will contact the applicant for payment details.";

export const SitePurpose = z.enum(["commercial", "recreational", "scientific", "educational"]);

const SITE_PURPOSE_VALUES =
  "'commercial': the product is ultimately sold. " +
  "'recreational': kept for personal use, not sold. " +
  "'scientific': research. 'educational': teaching.";

/** Owner/operator exemptions, from the form's "Designating Assistants" page. */
export const OwnerOperatorExemption = z.enum([
  "none",
  "lease_in_own_name",
  "ownership_interest_50_plus",
  "applied_for_lease_own_name",
  "ownership_interest_in_applicant_company",
  "upweller_only",
]);

const OWNER_OPERATOR_EXEMPTION_VALUES =
  "'none': no exemption claimed, the applicant will supervise or designate a primary assistant. " +
  "'lease_in_own_name': holds an experimental or standard lease in their own name. " +
  "'ownership_interest_50_plus': owns 50% or more of a company that holds an experimental or standard lease. " +
  "'applied_for_lease_own_name': has applied for a lease in their own name, and this LPA sits within that proposed site. " +
  "'ownership_interest_in_applicant_company': has an ownership interest in a company that has applied for a lease, and this LPA sits within the proposed boundaries. " +
  "'upweller_only': the site is an upweller and nothing else.";

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

/** Wording follows the gear definitions printed on the form. */
const GEAR_CATEGORY_VALUES =
  "'no_gear_bottom_culture': grown on the bottom, no gear or predator netting. " +
  "'upweller': floating upweller system for spat grow-out. " +
  "'shellfish_rafts': floating raft with suspended dropper lines and anti-predator netting, typical of mussel culture. " +
  "'tray_racks_and_overwintering_cages': rigid mesh boxes, often with interior shelves and floats, such as OysterGro or OysterRanch. " +
  "'soft_or_semi_rigid_bags_or_floating_trays': single-layer mesh bags, floated in lines, held in tray racks, or sunk to the bottom. " +
  "'lantern_or_pearl_nets': lantern nets are five or ten tiers of circular nets on a central line; pearl nets are single pyramidal enclosures. " +
  "'scallop_spat_collector_bags': mesh bags with added material to increase surface area, several on a vertical line. " +
  "'scallop_ear_hangers': lines attaching individual scallops by ear hangers. " +
  "'marine_algae_gear': rope, rafts with ropes, bags, longlines, or rope grids. " +
  "'bottom_anti_predator_netting': netting spread over the bottom to exclude predators.";

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
/* Species                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The form gives no free-text species box. It gives two printed checkbox lists,
 * and which list a species appears on carries a rule: hard clam, both surf
 * clams, soft-shelled clam, razor clam, European oyster and bay scallop may only
 * come from an approved hatchery. Modeling species as a plain string let the app
 * record "mussels", which matches no box on the form and would have to be
 * re-interpreted when the document is finally produced. Two enums instead, so
 * the wild list structurally cannot hold a hatchery-only species.
 */
const HATCHERY_SPECIES = [
  "blue_mussel",
  "eastern_oyster",
  "hard_clam_quahog",
  "soft_shelled_clam",
  "atlantic_surf_clam",
  "arctic_surf_clam",
  "razor_clam",
  "green_sea_urchin",
  "bay_scallop",
  "sugar_kelp",
  "skinny_kelp",
  "horsetail_kelp",
  "winged_kelp",
  "dulse",
  "european_oyster",
  "other",
] as const;

const WILD_SPECIES = [
  "blue_mussel",
  "eastern_oyster",
  "sea_scallop",
  "green_sea_urchin",
  "marine_algae",
] as const;

/**
 * Everything the form lets you cultivate, which is the two printed lists taken
 * together, in the order they appear.
 *
 * This is the list the applicant answers first, and it is the one question in
 * this section that is about the species rather than about where it comes from.
 * Which of the two tables a species ends up in is a fact about its source, and
 * three species are printed on both, so it cannot be settled by naming a
 * species. Splitting them is the whole point: people say what they are growing
 * long before they know which hatchery they are buying from.
 */
const CULTIVATED_SPECIES = [
  "blue_mussel",
  "eastern_oyster",
  "hard_clam_quahog",
  "soft_shelled_clam",
  "atlantic_surf_clam",
  "arctic_surf_clam",
  "razor_clam",
  "green_sea_urchin",
  "bay_scallop",
  "sea_scallop",
  "sugar_kelp",
  "skinny_kelp",
  "horsetail_kelp",
  "winged_kelp",
  "dulse",
  "marine_algae",
  "european_oyster",
  "other",
] as const;

export const HatcherySpecies = z.enum(HATCHERY_SPECIES);
export const WildSpecies = z.enum(WILD_SPECIES);
export const CultivatedSpecies = z.enum(CULTIVATED_SPECIES);

/** Whether the species is printed on the hatchery table, the wild table, or both. */
export function isHatcheryEligible(species: string): boolean {
  return (HATCHERY_SPECIES as readonly string[]).includes(species);
}
export function isWildEligible(species: string): boolean {
  return (WILD_SPECIES as readonly string[]).includes(species);
}

/**
 * The table a species can only belong to, when there is only one.
 *
 * Blue mussel, American oyster and green sea urchin are printed on both tables,
 * so naming one of those settles nothing and the applicant has to be asked.
 * Everything else is printed on exactly one, so naming it also places its
 * source, which is what lets the interview stop asking a question it can
 * already answer.
 */
export function soleTableFor(species: string): "hatchery" | "wild" | null {
  const hatchery = isHatcheryEligible(species);
  const wild = isWildEligible(species);
  if (hatchery === wild) return null;
  return hatchery ? "hatchery" : "wild";
}

/** Printed names from the form, for the model, the review screen and the output. */
export const SPECIES_LABELS: Record<string, string> = {
  blue_mussel: "Blue mussel (Mytilus edulis)",
  eastern_oyster: "American/eastern oyster (Crassostrea virginica)",
  hard_clam_quahog: "Hard clam/quahog (Mercenaria mercenaria)",
  soft_shelled_clam: "Soft-shelled clam (Mya arenaria)",
  atlantic_surf_clam: "Atlantic surf clam (Spisula solidissima)",
  arctic_surf_clam: "Arctic surf clam (Mactromeris polynyma)",
  razor_clam: "Razor clam (Ensis leei)",
  green_sea_urchin: "Green sea urchin (Strongylocentrotus droebachiensis)",
  bay_scallop: "Bay scallop (Aequipecten irradians)",
  sea_scallop: "Sea scallop (Placopecten magellanicus)",
  sugar_kelp: "Sugar kelp (Saccharina latissima)",
  skinny_kelp: "Skinny kelp (Saccharina angustissima)",
  horsetail_kelp: "Horsetail kelp (Laminaria digitata)",
  winged_kelp: "Winged kelp (Alaria esculenta)",
  dulse: "Dulse (Palmaria palmata)",
  european_oyster: "European oyster (Ostrea edulis)",
  marine_algae: "Marine algae",
  other: "Other (name it in the species notes)",
};

/** Turns a stored species key into something a person reads. */
export function speciesLabel(key: string | null | undefined): string {
  if (!key) return "unnamed species";
  return SPECIES_LABELS[key] ?? key;
}

/** The printed name without its scientific name, for reading mid-sentence. */
export function speciesShortLabel(key: string): string {
  return speciesLabel(key).replace(/\s*\(.*\)$/, "");
}

function speciesGlossary(keys: readonly string[]): string {
  return keys.map((key) => `'${key}': ${SPECIES_LABELS[key]}.`).join(" ");
}

const HATCHERY_SPECIES_VALUES =
  `${speciesGlossary(HATCHERY_SPECIES)} ` +
  "Note there is no approved hatchery for European oyster at present. " +
  "Use 'other' only when the species genuinely isn't on this list.";

const CULTIVATED_SPECIES_VALUES =
  `${speciesGlossary(CULTIVATED_SPECIES)} ` +
  "Record what they are growing as soon as they name it, without waiting to " +
  "learn where it comes from. Blue mussel, American/eastern oyster and green " +
  "sea urchin may be either hatchery-raised or taken from the wild, and that is " +
  "asked separately, so naming one of those here settles nothing about its source.";

const WILD_SPECIES_VALUES =
  `${speciesGlossary(WILD_SPECIES)} ` +
  "Only these may be taken from the wild. Hard clam, surf clams, soft-shelled " +
  "clam, razor clam, European oyster and bay scallop must come from an approved " +
  "hatchery, so they never appear here.";

/* -------------------------------------------------------------------------- */
/* Repeating sub-structures                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One block of the "Existing Uses" section. The form asks the same five
 * questions about commercial fishing, recreational fishing, boating, and other
 * water-related uses, so the shape is defined once and used four times.
 */
export const UseObservationSchema = z.object({
  /**
   * "None observed" is a real answer to every one of these, and until this field
   * existed there was no way to record it.
   *
   * The form asks "what type of commercial fishing occurs in the area?" and
   * assumes there is some. An applicant who says "none" was leaving a record that
   * could only be null, and null means "not mentioned" everywhere in this app, so
   * the question would simply be asked again. Told that "none" is a real answer
   * and given only a five-part record to put it in, the extraction model returned
   * `false` for the whole record, which failed the schema and cost the turn.
   *
   * Nullable, like everything else here: null is unasked, false is none observed,
   * true means the boxes below describe what was seen.
   */
  occurs: z
    .boolean()
    .nullable()
    .describe(
      "Whether this kind of use happens on or around the site at all. False when " +
        "the applicant says there is none, which is a real and common answer, and " +
        "the remaining fields then stay null. True when they describe any of it."
    ),
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
  occurs: null,
  activityTypes: null,
  seasons: null,
  frequency: null,
  occursWithinSite: null,
  anticipatedImpacts: null,
};

/**
 * Where one species comes from, if it comes from a hatchery.
 *
 * A row here is the hatchery table's row for that species: checking the box and
 * filling the source column are the same act on the printed form. The species
 * carries no note of its own, because naming an unlisted species is a fact about
 * what is being grown, asked once on the species question rather than once per
 * source.
 */
export const HatcherySourceSchema = z.object({
  species: HatcherySpecies.describe(
    `Which species this source supplies. ${HATCHERY_SPECIES_VALUES}`
  ),
  hatcheryName: z.string().nullable().describe("Name of the DMR-approved hatchery or facility."),
  hatcheryAddress: z.string().nullable(),
  hatcheryPhone: z.string().nullable(),
});

/** Where one species comes from, if it is taken from the wild or another site. */
export const WildSourceSchema = z.object({
  species: WildSpecies.describe(`Which species this source supplies. ${WILD_SPECIES_VALUES}`),
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
  feature: NearbyFeature.describe(
    "Which listed feature this is. Values name themselves: a town landing is a " +
      "'docking_facility', a marked channel is a 'navigational_channel', another " +
      "grower's site is 'aquaculture_leases_or_lpas'."
  ),
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
  paymentType: PaymentType.nullable()
    .describe(`How the application fee will be paid. ${PAYMENT_TYPE_VALUES}`),

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
    "Which owner/operator exemption the applicant claims. " +
      `Use 'none' when they say they aren't claiming one. ${OWNER_OPERATOR_EXEMPTION_VALUES}`
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
  purpose: SitePurpose.nullable().describe(
    `Purpose of the operation. ${SITE_PURPOSE_VALUES}`
  ),

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
  species: z
    .array(CultivatedSpecies)
    .nullable()
    .describe(
      `Every species the applicant intends to cultivate on the site, whatever its source. ${CULTIVATED_SPECIES_VALUES}`
    ),
  otherSpeciesNote: z
    .string()
    .nullable()
    .describe("Names the species for the form's 'Other' row, when 'other' is among the species."),
  marineAlgaeNote: z
    .string()
    .nullable()
    .describe("Names which marine algae, when 'marine_algae' is among the species."),
  hatcherySources: z.array(HatcherySourceSchema).nullable(),
  wildSources: z.array(WildSourceSchema).nullable(),
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
  gearCategories: z
    .array(GearCategory)
    .nullable()
    .describe(
      `Every gear category the applicant is seeking authorization for. ${GEAR_CATEGORY_VALUES}`
    ),
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

// The status vocabulary is the machine's, shared by every form's tracker, so it
// lives with the definition types and is re-exported here for the LPA modules.
export { RequirementStatus };

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

  /**
   * Fields the interview has stopped asking about, having asked twice and got
   * nothing back either time.
   *
   * Without this the interview can only ever repeat itself. An applicant who
   * cannot answer a question, or whose answer the extraction model keeps failing
   * to read, has no way past it: saying "next question" is not an answer, so
   * nothing changes, so the same question comes back. That happened, and it took
   * an applicant saying "let's move on" twice and being ignored to notice.
   *
   * A deferred field is set aside, not resolved. It still counts as missing in
   * `applicationProgress`, still shows on the review screen, and can still be
   * filled in there or mentioned in conversation later. All that changes is that
   * the interview stops asking.
   */
  deferredFields: z.array(z.string()),

  /**
   * The field the previous turn asked about and got nothing for.
   *
   * One turn producing nothing is ordinary: people ask questions mid-form, or
   * answer something else. Two in a row on the same field means the question
   * isn't working, and this is what tells them apart across turns.
   */
  stalledOn: z.string().nullable(),
});

export type LpaApplication = z.infer<typeof LpaApplicationSchema>;

/** Every form field, unanswered. The starting point for a new application. */
export const EMPTY_LPA_APPLICATION: LpaApplication = {
  ...(Object.fromEntries(
    Object.keys(LpaFormSchema.shape).map((key) => [key, null])
  ) as unknown as LpaForm),
  externalRequirements: {},
  pendingConcern: null,
  deferredFields: [],
  stalledOn: null,
};

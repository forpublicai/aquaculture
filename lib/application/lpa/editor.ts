/**
 * How each LPA field is edited by hand on the review screen.
 *
 * The interview collects answers in conversation, which needs no notion of a
 * text box or a dropdown. The review screen does: it has to put a control in
 * front of the applicant for every one of the form's fields, and the shape of
 * that control depends on the field's type in a way nothing else in the app
 * cared about until now.
 *
 * Three files now describe a field, each for a different reader:
 *
 * - `schema.ts` says what the data *is*, in terms the extraction model reads.
 * - `fields.ts` says what to *ask*, in terms the applicant reads.
 * - this file says how to *edit* it, in terms the review screen renders.
 *
 * `LPA_EDITORS` is typed as `Record<LpaFormKey, Control>`, so adding a field to
 * `LpaFormSchema` fails the typecheck here until it has an editor. That is the
 * point of the annotation: a field with no control would otherwise be silently
 * uneditable, visible on the review screen with no way to correct it, which is
 * the one thing this screen exists to prevent.
 *
 * The enum labels below are new. Every enum in `schema.ts` already carries a
 * glossary, but those are written for the extraction model: they are full
 * sentences explaining when a value applies, far too long for a dropdown. These
 * are the same values as printed on the form.
 */
import {
  CultivatedSpecies,
  GearCategory,
  HatcherySpecies,
  NearbyFeature,
  OwnerOperatorExemption,
  PaymentType,
  RequirementStatus,
  SitePurpose,
  SPECIES_LABELS,
  WildSpecies,
  type LpaFormKey,
} from "./schema";

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

export interface Choice {
  value: string;
  label: string;
}

/**
 * `record` and `record_list` nest one level and no further, which covers every
 * composite the form has. Nothing here recurses beyond `parts`.
 */
export type Control =
  | { kind: "text" }
  | { kind: "textarea" }
  | { kind: "number"; unit?: string }
  | { kind: "date" }
  | { kind: "boolean" }
  /** One value from a fixed list. */
  | { kind: "choice"; choices: Choice[] }
  /** Any number of values from a fixed list, i.e. the form's checkbox rows. */
  | { kind: "choice_list"; choices: Choice[] }
  /** A list of free-text entries, such as license acronyms or assistant names. */
  | { kind: "text_list"; itemLabel: string }
  /** A single object with named parts, such as one existing-use observation. */
  | { kind: "record"; parts: RecordPart[] }
  /** A repeating table, such as the gear list or the stock list. */
  | { kind: "record_list"; itemLabel: string; parts: RecordPart[] };

export interface RecordPart {
  key: string;
  label: string;
  control: Control;
  /** Shown under the input where the form's wording needs explaining. */
  hint?: string;
  /**
   * True where the underlying schema field is not nullable, so a row without it
   * cannot be saved. Only a handful of parts are: a gear row with no gear named
   * and a landowner row with no owner named are not partial records, they are
   * empty ones.
   */
  required?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Labels for the form's fixed lists                                           */
/* -------------------------------------------------------------------------- */

function choicesFrom(values: readonly string[], labels: Record<string, string>): Choice[] {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  check: "Check enclosed with the application",
  credit_card: "DMR will contact me for card details",
};

const SITE_PURPOSE_LABELS: Record<string, string> = {
  commercial: "Commercial, the product is sold",
  recreational: "Recreational, kept for personal use",
  scientific: "Scientific research",
  educational: "Educational",
};

const OWNER_OPERATOR_EXEMPTION_LABELS: Record<string, string> = {
  none: "No exemption claimed",
  lease_in_own_name: "I hold an experimental or standard lease in my own name",
  ownership_interest_50_plus: "I own 50% or more of a company that holds a lease",
  applied_for_lease_own_name: "I have applied for a lease in my own name covering this site",
  ownership_interest_in_applicant_company:
    "I have an ownership interest in a company that has applied for a lease covering this site",
  upweller_only: "The site is an upweller and nothing else",
};

const GEAR_CATEGORY_LABELS: Record<string, string> = {
  no_gear_bottom_culture: "Bottom culture with no gear or predator netting",
  upweller: "Floating upweller system",
  shellfish_rafts: "Shellfish rafts with suspended dropper lines",
  tray_racks_and_overwintering_cages: "Tray racks and overwintering cages",
  soft_or_semi_rigid_bags_or_floating_trays: "Soft or semi-rigid bags, or floating trays",
  lantern_or_pearl_nets: "Lantern or pearl nets",
  scallop_spat_collector_bags: "Scallop spat collector bags",
  scallop_ear_hangers: "Scallop ear hangers",
  marine_algae_gear: "Marine algae gear",
  bottom_anti_predator_netting: "Bottom anti-predator netting",
};

const NEARBY_FEATURE_LABELS: Record<string, string> = {
  federal_navigation_project_or_anchorage: "Federal navigation project or anchorage",
  navigational_channel: "Navigational channel",
  structures: "Structures",
  aquaculture_leases_or_lpas: "Aquaculture leases or LPAs",
  anchorages_or_moorings: "Anchorages or moorings",
  state_or_federal_beach: "State or federal beach",
  docking_facility: "Docking facility",
};

const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  not_applicable: "Not applicable",
};

export const PAYMENT_TYPE_CHOICES = choicesFrom(PaymentType.options, PAYMENT_TYPE_LABELS);
export const SITE_PURPOSE_CHOICES = choicesFrom(SitePurpose.options, SITE_PURPOSE_LABELS);
export const OWNER_OPERATOR_EXEMPTION_CHOICES = choicesFrom(
  OwnerOperatorExemption.options,
  OWNER_OPERATOR_EXEMPTION_LABELS
);
export const GEAR_CATEGORY_CHOICES = choicesFrom(GearCategory.options, GEAR_CATEGORY_LABELS);
export const NEARBY_FEATURE_CHOICES = choicesFrom(NearbyFeature.options, NEARBY_FEATURE_LABELS);
export const CULTIVATED_SPECIES_CHOICES = choicesFrom(CultivatedSpecies.options, SPECIES_LABELS);
export const HATCHERY_SPECIES_CHOICES = choicesFrom(HatcherySpecies.options, SPECIES_LABELS);
export const WILD_SPECIES_CHOICES = choicesFrom(WildSpecies.options, SPECIES_LABELS);
export const REQUIREMENT_STATUS_CHOICES = choicesFrom(
  RequirementStatus.options,
  REQUIREMENT_STATUS_LABELS
);

/* -------------------------------------------------------------------------- */
/* Shared composite shapes                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The five questions the form asks about each existing use. Defined once and
 * used four times, mirroring `UseObservationSchema`.
 */
const USE_OBSERVATION_PARTS: RecordPart[] = [
  {
    key: "occurs",
    label: "Does this happen here?",
    control: { kind: "boolean" },
    hint: "No is a real answer, and the rest of this block then stays blank.",
  },
  { key: "activityTypes", label: "Kinds of activity", control: { kind: "textarea" } },
  { key: "seasons", label: "Seasons", control: { kind: "text" } },
  { key: "frequency", label: "How often", control: { kind: "text" } },
  {
    key: "occursWithinSite",
    label: "Inside the site?",
    control: { kind: "text" },
    hint: "If it happens outside the site, say where relative to it, such as 150 feet to the west.",
  },
  {
    key: "anticipatedImpacts",
    label: "Impacts you expect",
    control: { kind: "textarea" },
  },
];

/**
 * One row of the form's hatchery table. The species is the row's identity, which
 * is why it is the one required part: a source that names no species is a filled
 * column against an unchecked box.
 */
const HATCHERY_SOURCE_PARTS: RecordPart[] = [
  {
    key: "species",
    label: "Species",
    control: { kind: "choice", choices: HATCHERY_SPECIES_CHOICES },
    required: true,
  },
  { key: "hatcheryName", label: "Hatchery or facility", control: { kind: "text" } },
  { key: "hatcheryAddress", label: "Hatchery address", control: { kind: "text" } },
  { key: "hatcheryPhone", label: "Hatchery phone", control: { kind: "text" } },
];

/** One row of the form's wild stock table. */
const WILD_SOURCE_PARTS: RecordPart[] = [
  {
    key: "species",
    label: "Species",
    control: { kind: "choice", choices: WILD_SPECIES_CHOICES },
    required: true,
  },
  { key: "waterbody", label: "Waterbody harvested from", control: { kind: "text" } },
  {
    key: "healthZone",
    label: "Health zone of the source",
    control: { kind: "text" },
    hint: "Must be the same LPA health zone as the license site.",
  },
  { key: "harvesterName", label: "Licensed harvester", control: { kind: "text" } },
  { key: "harvesterLicenseNumber", label: "Harvester license number", control: { kind: "text" } },
  { key: "aquacultureSiteId", label: "Source aquaculture site ID", control: { kind: "text" } },
];

const GEAR_ITEM_PARTS: RecordPart[] = [
  {
    key: "description",
    label: "Gear item",
    control: { kind: "text" },
    hint: "Every item going in the water, including lines and moorings.",
    required: true,
  },
  { key: "maximumNumber", label: "Maximum number", control: { kind: "number" } },
  { key: "dimensions", label: "Dimensions of one unit", control: { kind: "text" } },
  { key: "datesInWater", label: "Dates in the water", control: { kind: "text" } },
];

const NEARBY_FEATURE_PARTS: RecordPart[] = [
  {
    key: "feature",
    label: "Feature",
    control: { kind: "choice", choices: NEARBY_FEATURE_CHOICES },
    required: true,
  },
  { key: "impact", label: "Your impact on it", control: { kind: "textarea" } },
];

const RIPARIAN_LANDOWNER_PARTS: RecordPart[] = [
  { key: "ownerName", label: "Owner name", control: { kind: "text" }, required: true },
  { key: "taxMapNumber", label: "Tax map number", control: { kind: "text" } },
  { key: "lotNumber", label: "Lot number", control: { kind: "text" } },
  {
    key: "mailingAddress",
    label: "Mailing address",
    control: { kind: "textarea" },
    hint: "As it appears in municipal tax records. This is the address the certified mailing goes to.",
  },
];

/* -------------------------------------------------------------------------- */
/* One control per field                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ordered to match `LpaFormSchema`, which matches the printed form. The
 * `Record<LpaFormKey, Control>` annotation is what makes this exhaustive.
 */
export const LPA_EDITORS: Record<LpaFormKey, Control> = {
  /* Applicant information */
  applicantName: { kind: "text" },
  applicantAddress: { kind: "text" },
  applicantCity: { kind: "text" },
  applicantStateZip: { kind: "text" },
  applicantTelephone: { kind: "text" },
  applicantEmail: { kind: "text" },
  applicantDateOfBirth: { kind: "date" },
  isMaineResident: { kind: "boolean" },
  hasPreviouslyAppliedForSite: { kind: "boolean" },
  previousLpaAcronyms: { kind: "text_list", itemLabel: "LPA acronym" },
  paymentType: { kind: "choice", choices: PAYMENT_TYPE_CHOICES },

  /* Existing aquaculture activities */
  isAssistantOnOtherLpas: { kind: "boolean" },
  assistantLpaAcronyms: { kind: "text_list", itemLabel: "LPA acronym" },
  holdsOtherLpaLicenses: { kind: "boolean" },
  otherLpaAcronyms: { kind: "text_list", itemLabel: "LPA acronym" },

  /* Assistants and supervision */
  assistantNames: { kind: "text_list", itemLabel: "Assistant name" },
  primaryAssistantName: { kind: "text" },
  primaryAssistantEmail: { kind: "text" },
  ownerOperatorExemption: { kind: "choice", choices: OWNER_OPERATOR_EXEMPTION_CHOICES },
  exemptionLeaseAcronym: { kind: "text" },
  exemptionCompanyName: { kind: "text" },
  exemptionOwnershipPercent: { kind: "number", unit: "%" },

  /* Location of the license site */
  town: { kind: "text" },
  county: { kind: "text" },
  waterbody: { kind: "text" },
  siteDescription: { kind: "textarea" },
  latitude: { kind: "number", unit: "°N" },
  longitude: { kind: "number", unit: "°" },
  lpaHealthZone: { kind: "text" },
  isAboveMeanLowWater: { kind: "boolean" },
  isAboveExtremeLowWater: { kind: "boolean" },
  isMarinaOrPoundSite: { kind: "boolean" },
  municipalityHasHarbormaster: { kind: "boolean" },
  purpose: { kind: "choice", choices: SITE_PURPOSE_CHOICES },

  /* Water quality classification */
  growingAreaDesignation: { kind: "text" },
  isInRestrictedOrProhibitedArea: { kind: "boolean" },
  restrictedAreaRequirementsAcknowledged: { kind: "boolean" },
  associatedLeaseSiteIds: { kind: "text_list", itemLabel: "Lease site ID" },

  /* Species and source of stock */
  species: { kind: "choice_list", choices: CULTIVATED_SPECIES_CHOICES },
  otherSpeciesNote: { kind: "text" },
  marineAlgaeNote: { kind: "text" },
  hatcherySources: {
    kind: "record_list",
    itemLabel: "Hatchery source",
    parts: HATCHERY_SOURCE_PARTS,
  },
  wildSources: { kind: "record_list", itemLabel: "Wild source", parts: WILD_SOURCE_PARTS },
  wildTakeComplianceAcknowledged: { kind: "boolean" },
  scallopAdductorOnlyAcknowledged: { kind: "boolean" },

  /* Site characteristics */
  uplandsDescription: { kind: "textarea" },
  bottomCharacteristics: { kind: "textarea" },
  depthAtMeanLowWaterFt: { kind: "number", unit: "ft" },
  depthAtMeanHighWaterFt: { kind: "number", unit: "ft" },
  isInEssentialHabitat: { kind: "boolean" },
  hasEagleNestWithin660Ft: { kind: "boolean" },
  eelgrassDescription: { kind: "textarea" },
  eelgrassObservedMonth: { kind: "text" },
  eelgrassObservedYear: { kind: "number" },

  /* Existing uses of the area */
  commercialFishingUse: { kind: "record", parts: USE_OBSERVATION_PARTS },
  recreationalFishingUse: { kind: "record", parts: USE_OBSERVATION_PARTS },
  boatingUse: { kind: "record", parts: USE_OBSERVATION_PARTS },
  otherWaterUse: { kind: "record", parts: USE_OBSERVATION_PARTS },

  /* Vicinity map features */
  hasNoNearbyFeatures: { kind: "boolean" },
  nearbyFeatures: { kind: "record_list", itemLabel: "Feature", parts: NEARBY_FEATURE_PARTS },

  /* Gear description and layout */
  gearCategories: { kind: "choice_list", choices: GEAR_CATEGORY_CHOICES },
  gearItems: { kind: "record_list", itemLabel: "Gear item", parts: GEAR_ITEM_PARTS },
  gearLayoutWidthFt: { kind: "number", unit: "ft" },
  gearLayoutLengthFt: { kind: "number", unit: "ft" },
  mooringDescription: { kind: "textarea" },
  seasonalGearChanges: { kind: "textarea" },

  /* Bird deterrence */
  birdDeterrenceMeasures: { kind: "textarea" },

  /* Riparian notification */
  hasShorefrontWithin300Ft: { kind: "boolean" },
  riparianMunicipality: { kind: "text" },
  riparianLandowners: {
    kind: "record_list",
    itemLabel: "Landowner",
    parts: RIPARIAN_LANDOWNER_PARTS,
  },
};

/**
 * A blank entry for a `record` or `record_list` control.
 *
 * Every part starts unanswered, the required ones included. A required choice
 * is deliberately not pre-filled with the first option on its list: the row
 * would read as answered while holding a value nobody chose, and a plausible
 * wrong value looks answered, is never revisited, and goes out on the form. The
 * review screen refuses to save a row until its required parts are filled in, so
 * an unanswered required part arrives as a prompt rather than as an error.
 */
export function emptyEntry(parts: RecordPart[]): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const part of parts) {
    if (!part.required) {
      entry[part.key] = null;
      continue;
    }
    entry[part.key] = part.control.kind === "choice" ? null : "";
  }
  return entry;
}

/**
 * What an empty list should actually be stored as.
 *
 * An empty list is only an answer where the form asks the question that way, so
 * "none of these" stays distinguishable from "never asked". Everywhere else,
 * taking the last entry out means the field goes back to unanswered.
 *
 * Without this a field could strand itself holding an empty array: unanswered by
 * every count in the app, and with no Clear button offered to fix it, since Clear
 * only appears on fields that read as answered.
 */
export function normalizeForSave(value: unknown, emptyListIsAnswer: boolean): unknown {
  if (Array.isArray(value) && value.length === 0 && !emptyListIsAnswer) return null;
  return value;
}

/** Required parts left blank, which is what stops a row being saved. */
export function missingRequiredParts(
  parts: RecordPart[],
  entry: Record<string, unknown>
): RecordPart[] {
  return parts.filter((part) => {
    if (!part.required) return false;
    const value = entry[part.key];
    return value === null || value === undefined || String(value).trim() === "";
  });
}

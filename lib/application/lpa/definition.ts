/**
 * The LPA license application, assembled as a `LicenseDefinition`.
 *
 * Everything form-specific that used to live inline in the interview — the
 * extraction shapes for coordinates and use observations, the asked-alone list,
 * the plausibility context — moved here when the machinery generalized, because
 * each of those is a fact about *this form*, not about interviewing.
 */
import { z } from "zod";

import { LicenseType, type OperationProfile } from "@/lib/routing/schema";

import { parseCoordinate, type Axis } from "../coordinates";
import type { AnyApplication, LicenseDefinition } from "../definition";

import { LPA_EDITORS } from "./editor";
import { fieldAnswered, fieldApplies, fieldHasContent, LPA_FIELDS, LPA_SECTIONS } from "./fields";
import { migrateApplication, seedSourceRows } from "./normalize";
import { validateApplication } from "./progress";
import { LPA_REQUIREMENTS } from "./requirements";
import {
  EMPTY_LPA_APPLICATION,
  EMPTY_USE_OBSERVATION,
  LpaFormSchema,
  UseObservationSchema,
  type LpaApplication,
  type LpaFormKey,
} from "./schema";

/* -------------------------------------------------------------------------- */
/* Extraction shapes the form needs                                            */
/* -------------------------------------------------------------------------- */

/**
 * Fields the extraction model is asked for in a different shape than the form
 * stores them, because the applicant's wording needs converting in code.
 *
 * The form wants coordinates as decimal degrees and says so. Applicants read
 * theirs off a chartplotter, which shows degrees, minutes and seconds. Asking
 * for a number means the model either does the arithmetic silently, which this
 * codebase has decided repeatedly not to trust a model with, or returns null
 * because the instructions tell it never to invent a value. Either way the
 * answer is lost. So the field is widened to accept their exact wording, and
 * the coercion turns it into a number where the sums can be read and tested.
 */
function coordinateField(axis: Axis) {
  return z
    .union([z.number(), z.string()])
    .nullable()
    .describe(
      `The site's ${axis} for its center point. If the applicant already gave ` +
        "decimal degrees, return the number, negative for west and south. If they " +
        "gave any other format, degrees and minutes and seconds for instance, " +
        "return their wording exactly as a string and it will be converted. Do " +
        "not do the conversion yourself."
    );
}

/**
 * One of the form's four existing-use blocks, in the shape the model answers in.
 *
 * Asked whether there is any boating around the site and told there is none, the
 * model returns `false`. Not a five-part record with `occurs` false: just
 * `false`. It did that before `occurs` existed, and it kept doing it afterwards,
 * through an instruction telling it not to. Which is fair enough. "No boating
 * happens near my site" is a yes/no answer, the field is the only place to put
 * it, and the instructions elsewhere say to record "none" as false.
 *
 * So the schema now says what the model already does. A boolean is accepted and
 * `asUseObservation` expands it, in code, into the record the form stores.
 * Partial records are accepted for the same reason.
 */
function useObservationField() {
  return z
    .union([UseObservationSchema.partial(), z.boolean()])
    .nullable()
    .describe(
      "What the applicant has observed of this kind of use on or around the " +
        "site. Answer with the record. If they say there is none of it, false on " +
        "its own is accepted and means the same as the record with 'occurs' " +
        "false. Leave out, or set null, any part they said nothing about. Null " +
        "for the whole field means they did not mention this kind of use."
    );
}

/**
 * A use observation from whatever the model sent.
 *
 * Returns null for anything that says nothing, rather than an empty record,
 * because the merge writes any non-null value: an all-null record would overwrite
 * a real answer given on an earlier turn with nothing at all.
 */
function asUseObservation(value: unknown): unknown {
  if (typeof value === "boolean") return { ...EMPTY_USE_OBSERVATION, occurs: value };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const observation = { ...EMPTY_USE_OBSERVATION, ...(value as Record<string, unknown>) };
  const saysSomething =
    typeof observation.occurs === "boolean" ||
    Object.values(observation).some((part) => typeof part === "string" && part.trim() !== "");
  return saysSomething ? observation : null;
}

const USE_OBSERVATION_FIELDS = [
  "commercialFishingUse",
  "recreationalFishingUse",
  "boatingUse",
  "otherWaterUse",
] as const;

const EXTRACTION_OVERRIDES: Record<string, z.ZodTypeAny> = {
  latitude: coordinateField("latitude"),
  longitude: coordinateField("longitude"),
  ...Object.fromEntries(USE_OBSERVATION_FIELDS.map((key) => [key, useObservationField()])),
};

const COERCIONS: Record<string, (value: unknown) => unknown> = {
  latitude: (value) => parseCoordinate(value, "latitude"),
  longitude: (value) => parseCoordinate(value, "longitude"),
  ...Object.fromEntries(USE_OBSERVATION_FIELDS.map((key) => [key, asUseObservation])),
};

/**
 * Fields that ask for a table or a multi-part narrative. Bundling one of these
 * with other questions produces a wall of text nobody answers completely. The
 * four use-observation blocks are here for the same reason.
 */
const ASKED_ALONE: ReadonlySet<string> = new Set<LpaFormKey>([
  "species",
  "hatcherySources",
  "wildSources",
  "gearItems",
  "gearCategories",
  "nearbyFeatures",
  "riparianLandowners",
  "birdDeterrenceMeasures",
  "mooringDescription",
  "lpaHealthZone",
  ...USE_OBSERVATION_FIELDS,
]);

/* -------------------------------------------------------------------------- */
/* Plausibility configuration                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Fields holding the applicant's own prose. Nothing here can be checked against
 * outside fact, so a turn that only changes these never triggers a call.
 */
const NARRATIVE_KEYS: ReadonlySet<string> = new Set([
  "uplandsDescription",
  "bottomCharacteristics",
  "siteDescription",
  "mooringDescription",
  "seasonalGearChanges",
  "birdDeterrenceMeasures",
  "eelgrassDescription",
  "commercialFishingUse",
  "recreationalFishingUse",
  "boatingUse",
  "otherWaterUse",
  "nearbyFeatures",
]);

/**
 * What the model gets to cross-reference against, beyond the fields that just
 * changed. This list is the check's actual reach: a contradiction can only be
 * spotted if *both* halves are visible.
 */
const CONTEXT_KEYS: string[] = [
  // Where the site is.
  "town",
  "county",
  "waterbody",
  "latitude",
  "longitude",
  "lpaHealthZone",
  "growingAreaDesignation",
  "isInRestrictedOrProhibitedArea",
  // How it sits in the water.
  "isAboveMeanLowWater",
  "isAboveExtremeLowWater",
  "isMarinaOrPoundSite",
  "depthAtMeanLowWaterFt",
  "depthAtMeanHighWaterFt",
  // What's grown and how.
  "species",
  "hatcherySources",
  "wildSources",
  "gearCategories",
  "gearLayoutWidthFt",
  "gearLayoutLengthFt",
  "purpose",
  "ownerOperatorExemption",
  // Who's applying.
  "applicantCity",
  "applicantStateZip",
  "isMaineResident",
  // Surroundings.
  "hasNoNearbyFeatures",
  "hasShorefrontWithin300Ft",
  "riparianMunicipality",
];

/**
 * The source tables carry addresses, phone numbers and license numbers, none of
 * which help decide whether the gear suits the species. What is kept is the
 * species and the one detail a contradiction could turn on.
 */
const CONTEXT_PARTS: Record<string, string[]> = {
  hatcherySources: ["species", "hatcheryName"],
  wildSources: ["species", "waterbody", "healthZone"],
};

/* -------------------------------------------------------------------------- */
/* Seeding and PDF                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Carries what triage already learned into a blank application. Only
 * `locationDescription` maps cleanly onto a form field; species and gear are
 * passed to the extraction model as context instead, because the form wants
 * them broken down in ways triage never asked about — which hatchery, which
 * gear category, how many units.
 */
function seed(profile: OperationProfile): LpaApplication {
  return {
    ...EMPTY_LPA_APPLICATION,
    siteDescription: profile.locationDescription,
  };
}

/**
 * The form's three tables whose printed checkbox is ticked per row: the map
 * keys them `hatcherySpecies.*`, `wildSpecies.*` and `nearbyFeatures.*`.
 */
function checkboxRowLists(app: AnyApplication): Record<string, string[]> {
  const rows = (value: unknown, member: string): string[] =>
    Array.isArray(value)
      ? value
          .map((row) => (row as Record<string, unknown> | null)?.[member])
          .filter((name): name is string => typeof name === "string")
      : [];
  return {
    hatcherySpecies: rows(app.hatcherySources, "species"),
    wildSpecies: rows(app.wildSources, "species"),
    nearbyFeatures: rows(app.nearbyFeatures, "feature"),
  };
}

/* -------------------------------------------------------------------------- */
/* The definition                                                              */
/* -------------------------------------------------------------------------- */

export const LPA_DEFINITION: LicenseDefinition = {
  id: "lpa",
  licenseType: LicenseType.LIMITED_PURPOSE_AQUACULTURE,
  shortName: "LPA license application",
  formTitle: "Maine DMR's Limited Purpose Aquaculture (LPA) license application",

  sections: LPA_SECTIONS,
  fields: LPA_FIELDS,
  formSchema: LpaFormSchema,
  emptyApplication: () => ({ ...EMPTY_LPA_APPLICATION }),
  editors: LPA_EDITORS,
  requirements: LPA_REQUIREMENTS,

  fieldAnswered,
  fieldHasContent,
  validate: validateApplication,
  migrate: (stored) => migrateApplication(stored) ?? { ...EMPTY_LPA_APPLICATION },
  seed,
  afterMerge: seedSourceRows,

  extractionOverrides: EXTRACTION_OVERRIDES,
  coercions: COERCIONS,
  askedAlone: ASKED_ALONE,

  narrativeKeys: NARRATIVE_KEYS,
  plausibilityContextKeys: CONTEXT_KEYS,
  plausibilityContextParts: CONTEXT_PARTS,

  pdf: {
    formFile: "LPA_Application.pdf",
    mapFile: "lpa-overlay-map.json",
    downloadName: "LPA-application",
    checkboxRowLists,
  },
};

// Re-exported so the check script can exercise them without reaching into the
// definition object.
export { fieldApplies };

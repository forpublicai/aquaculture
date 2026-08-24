/**
 * The Experimental Aquaculture Lease application, assembled as a
 * `LicenseDefinition`.
 */
import { z } from "zod";

import { LicenseType, type OperationProfile } from "@/lib/routing/schema";

import { parseCoordinate } from "../coordinates";
import type { LicenseDefinition } from "../definition";

import { EXPERIMENTAL_EDITORS } from "./editor";
import {
  EXPERIMENTAL_FIELDS,
  EXPERIMENTAL_SECTIONS,
  fieldAnswered,
  fieldHasContent,
} from "./fields";
import { migrateApplication } from "./normalize";
import { validateApplication } from "./progress";
import { EXPERIMENTAL_REQUIREMENTS } from "./requirements";
import {
  EMPTY_EXPERIMENTAL_APPLICATION,
  ExperimentalFormSchema,
  type ExperimentalApplication,
  type ExperimentalFormKey,
} from "./schema";

const SQ_FT_PER_ACRE = 43_560;

/* -------------------------------------------------------------------------- */
/* Extraction shapes the form needs                                            */
/* -------------------------------------------------------------------------- */

/**
 * The corner table, in the shape the model answers in.
 *
 * The form wants decimal degrees; applicants read corners off a chartplotter as
 * degrees, minutes and seconds. Same treatment as the LPA's center point: each
 * coordinate is widened to accept the applicant's exact wording and converted
 * in code, where the arithmetic can be read and tested. The model is told not
 * to convert, because a model doing sums silently is the thing this codebase
 * keeps deciding not to trust.
 */
const cornersExtractionShape = z
  .array(
    z.object({
      latitude: z
        .union([z.number(), z.string()])
        .nullable()
        .describe(
          "This corner's latitude. A number if the applicant gave decimal " +
            "degrees; otherwise their wording exactly as a string, and it will " +
            "be converted. Do not do the conversion yourself."
        ),
      longitude: z
        .union([z.number(), z.string()])
        .nullable()
        .describe(
          "This corner's longitude, negative for west if already a number; " +
            "otherwise their wording exactly as a string."
        ),
    })
  )
  .nullable()
  .describe(
    "The site's corners in order, NW corner first, proceeding clockwise. " +
      "Record every corner mentioned; the coordinates are converted in code."
  );

/**
 * Corners as the form stores them: both coordinates as numbers, or the row is
 * dropped. If no row survives, the whole answer becomes null and the question
 * is asked again — a corner read wrongly looks answered, is never revisited,
 * and draws the site somewhere it isn't.
 */
function coerceCorners(value: unknown): unknown {
  if (!Array.isArray(value)) return null;
  const converted = value
    .map((row) => {
      const record = row as Record<string, unknown> | null;
      if (!record || typeof record !== "object") return null;
      const latitude = parseCoordinate(record.latitude, "latitude");
      const longitude = parseCoordinate(record.longitude, "longitude");
      if (latitude === null || longitude === null) return null;
      return { latitude, longitude };
    })
    .filter((row): row is { latitude: number; longitude: number } => row !== null);
  return converted.length > 0 ? converted : null;
}

const EXTRACTION_OVERRIDES: Record<string, z.ZodTypeAny> = {
  corners: cornersExtractionShape,
};

const COERCIONS: Record<string, (value: unknown) => unknown> = {
  corners: coerceCorners,
};

/**
 * Fields whose question goes out alone: tables, and narratives long enough
 * that bundling them with anything else produces a wall of text.
 */
const ASKED_ALONE: ReadonlySet<string> = new Set<ExperimentalFormKey>([
  "studyPurpose",
  "iceFormationDescription",
  "hatcheryStock",
  "siteStock",
  "wildStock",
  "birdDeterrenceMeasures",
  "gearItems",
  "tendingDescription",
  "harvestMethods",
  "motorizedEquipment",
  "vessels",
  "govtPropertiesWithin1000Ft",
  "otherWaterActivities",
  "existingSites",
  "waterExperience",
  "riparianLandowners",
  "corners",
]);

/* -------------------------------------------------------------------------- */
/* Plausibility configuration                                                  */
/* -------------------------------------------------------------------------- */

/** The applicant's own prose and their tables of it: never argued with. */
const NARRATIVE_KEYS: ReadonlySet<string> = new Set<ExperimentalFormKey>([
  "generalDescription",
  "studyPurpose",
  "bottomCharacteristics",
  "currentSpeed",
  "currentDirection",
  "faunaDescription",
  "floraDescription",
  "iceFormationDescription",
  "birdDeterrenceMeasures",
  "freePlantedSpecies",
  "freePlantingAreas",
  "tendingDescription",
  "harvestMethods",
  "seasonalGearChangesDescription",
  "fixedNoiseDirectionPlan",
  "lightingGlareMeasures",
  "lightingMitigationMeasures",
  "generatorPurpose",
  "generatorNoiseMitigation",
  "motorizedEquipment",
  "floatingStructurePurpose",
  "floatingStructureMaterials",
  "floatingStructureGlareMeasures",
  "floatingStructureLightMitigation",
  "buildingPurpose",
  "buildingRoofingMaterials",
  "buildingSidingMaterials",
  "buildingVisualImpactMeasures",
  "shorelineDescription",
  "uplandsDescription",
  "waterExperience",
  "commercialNavVesselTypes",
  "recreationalNavVesselTypes",
  "commercialFishingWithinSiteTypes",
  "commercialFishingVicinityTypes",
  "recreationalFishingWithinSiteTypes",
  "recreationalFishingVicinityTypes",
  "riparianVesselTypes",
  "dockVesselLengths",
  "otherWaterActivities",
  "annualLeaseRent",
  "annualLicensingFees",
  "annualBondOrEscrowCost",
  "annualEquipmentCosts",
  "annualMaintenanceCosts",
]);

const CONTEXT_KEYS: string[] = [
  // Where the site is.
  "town",
  "county",
  "waterbody",
  "corners",
  "generalDescription",
  // Its shape and term.
  "totalAcreage",
  "leaseTermYears",
  "cultureTypes",
  "cultureMethod",
  "studyType",
  // How it sits in the water.
  "isAboveMeanLowWater",
  "depthAtMeanLowWaterFt",
  "depthAtMeanHighWaterFt",
  "usesSuspendedGear",
  // What's grown.
  "hatcheryStock",
  "siteStock",
  "wildStock",
  "growingAreaDesignation",
  "growingAreaClassification",
  // Who's applying.
  "mailingCity",
  "mailingState",
  "mailingZip",
  // Surroundings.
  "inMarkedNavigationChannel",
  "isWithin1000FtOfShorefront",
  "riparianMunicipality",
  "hasMooringsInVicinity",
  "hasDocksInArea",
];

const CONTEXT_PARTS: Record<string, string[]> = {
  hatcheryStock: ["commonName", "sourceName"],
  siteStock: ["commonName", "waterbody"],
  wildStock: ["commonName", "waterbody"],
  gearItems: ["type", "speciesGrown"],
};

/* -------------------------------------------------------------------------- */
/* Seeding                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Carries what triage already learned into a blank application. Location and
 * lease term map directly. Acreage is converted from triage's square feet in
 * arithmetic — the same conversion the routing rules already did in reverse —
 * and rounded to two decimals, which is the precision the form's own example
 * ("3.2 acres") uses. Species and gear stay as extraction context, because the
 * form wants them broken down in ways triage never asked about.
 */
function seed(profile: OperationProfile): ExperimentalApplication {
  return {
    ...EMPTY_EXPERIMENTAL_APPLICATION,
    generalDescription: profile.locationDescription,
    leaseTermYears: profile.leaseDurationYears,
    totalAcreage:
      profile.siteAreaSqFt !== null
        ? Math.round((profile.siteAreaSqFt / SQ_FT_PER_ACRE) * 100) / 100
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* The definition                                                              */
/* -------------------------------------------------------------------------- */

export const EXPERIMENTAL_DEFINITION: LicenseDefinition = {
  id: "experimental",
  licenseType: LicenseType.EXPERIMENTAL_LEASE,
  shortName: "Experimental lease application",
  formTitle: "Maine DMR's Experimental Aquaculture Lease application",

  sections: EXPERIMENTAL_SECTIONS,
  fields: EXPERIMENTAL_FIELDS,
  formSchema: ExperimentalFormSchema,
  emptyApplication: () => ({ ...EMPTY_EXPERIMENTAL_APPLICATION }),
  editors: EXPERIMENTAL_EDITORS,
  requirements: EXPERIMENTAL_REQUIREMENTS,

  fieldAnswered,
  fieldHasContent,
  validate: validateApplication,
  migrate: (stored) => migrateApplication(stored) ?? { ...EMPTY_EXPERIMENTAL_APPLICATION },
  seed,

  extractionOverrides: EXTRACTION_OVERRIDES,
  coercions: COERCIONS,
  askedAlone: ASKED_ALONE,

  narrativeKeys: NARRATIVE_KEYS,
  plausibilityContextKeys: CONTEXT_KEYS,
  plausibilityContextParts: CONTEXT_PARTS,

  pdf: {
    formFile: "Experimental_Lease_Application.pdf",
    downloadName: "Experimental-lease-application",
    // No overlay map yet: every answer goes out on labeled continuation sheets
    // appended after the untouched official form. Measuring a map for this form
    // is the same job build-overlay-map.py did for the LPA, and slots in here.
  },
};

/**
 * The Standard (non-discharge) Aquaculture Lease applications, assembled as two
 * `LicenseDefinition`s.
 *
 * Only the draft is seeded by triage, because the draft is what a new applicant
 * files first. The final application is the draft's registered successor: once
 * the draft is done and the scoping session held, the applicant advances, and
 * every answer whose question appears on both printed forms carries across (see
 * lib/application/advance.ts).
 */
import { z } from "zod";

import { LicenseType, type OperationProfile } from "@/lib/routing/schema";

import { coerceCorners, cornersExtractionShape } from "../corners";
import type { LicenseDefinition } from "../definition";

import { STANDARD_DRAFT_EDITORS, STANDARD_FINAL_EDITORS } from "./editor";
import {
  fieldAnswered,
  fieldHasContent,
  STANDARD_DRAFT_FIELDS,
  STANDARD_DRAFT_SECTIONS,
  STANDARD_FINAL_FIELDS,
  STANDARD_FINAL_SECTIONS,
} from "./fields";
import { migrateDraftApplication, migrateFinalApplication } from "./normalize";
import { validateDraftApplication, validateFinalApplication } from "./progress";
import { STANDARD_DRAFT_REQUIREMENTS, STANDARD_FINAL_REQUIREMENTS } from "./requirements";
import {
  EMPTY_STANDARD_DRAFT_APPLICATION,
  EMPTY_STANDARD_FINAL_APPLICATION,
  StandardDraftFormSchema,
  StandardFinalFormSchema,
  type StandardDraftApplication,
  type StandardDraftFormKey,
  type StandardFinalFormKey,
} from "./schema";

const SQ_FT_PER_ACRE = 43_560;

const EXTRACTION_OVERRIDES: Record<string, z.ZodTypeAny> = {
  corners: cornersExtractionShape,
};

const COERCIONS: Record<string, (value: unknown) => unknown> = {
  corners: coerceCorners,
};

/* -------------------------------------------------------------------------- */
/* Asked alone                                                                 */
/* -------------------------------------------------------------------------- */

const SHARED_ASKED_ALONE: string[] = [
  "hatcheryStock",
  "siteStock",
  "wildStock",
  "birdDeterrenceMeasures",
  "tendingDescription",
  "harvestMethods",
  "motorizedEquipment",
  "vessels",
  "govtPropertiesWithin1000Ft",
  "existingSites",
  "waterExperience",
  "riparianLandowners",
  "corners",
];

const DRAFT_ASKED_ALONE: ReadonlySet<string> = new Set<StandardDraftFormKey>([
  ...(SHARED_ASKED_ALONE as StandardDraftFormKey[]),
  "gearTypesDescription",
]);

const FINAL_ASKED_ALONE: ReadonlySet<string> = new Set<StandardFinalFormKey>([
  ...(SHARED_ASKED_ALONE as StandardFinalFormKey[]),
  "iceFormationDescription",
  "gearItems",
  "otherWaterActivities",
]);

/* -------------------------------------------------------------------------- */
/* Plausibility configuration                                                  */
/* -------------------------------------------------------------------------- */

const SHARED_NARRATIVE: string[] = [
  "generalDescription",
  "birdDeterrenceMeasures",
  "tendingDescription",
  "harvestMethods",
  "seasonalGearChangesDescription",
  "fixedNoiseDirectionPlan",
  "lightingMitigationMeasures",
  "generatorPurpose",
  "generatorNoiseMitigation",
  "motorizedEquipment",
  "floatingStructurePurpose",
  "floatingStructureLightMitigation",
  "buildingPurpose",
  "buildingVisualImpactMeasures",
  "waterExperience",
  "annualLeaseRent",
  "annualLicensingFees",
  "annualBondOrEscrowCost",
  "annualEquipmentCosts",
  "annualMaintenanceCosts",
];

const DRAFT_NARRATIVE: ReadonlySet<string> = new Set([
  ...SHARED_NARRATIVE,
  "gearTypesDescription",
]);

const FINAL_NARRATIVE: ReadonlySet<string> = new Set([
  ...SHARED_NARRATIVE,
  "bottomCharacteristics",
  "currentSpeed",
  "currentDirection",
  "faunaDescription",
  "floraDescription",
  "iceFormationDescription",
  "bottomPlantedSpecies",
  "bottomPlantingAreas",
  "lightingGlareMeasures",
  "floatingStructureMaterials",
  "floatingStructureGlareMeasures",
  "buildingRoofingMaterials",
  "buildingSidingMaterials",
  "shorelineDescription",
  "uplandsDescription",
  "commercialNavVesselTypes",
  "recreationalNavVesselTypes",
  "commercialFishingWithinSiteTypes",
  "commercialFishingVicinityTypes",
  "recreationalFishingWithinSiteTypes",
  "recreationalFishingVicinityTypes",
  "riparianVesselTypes",
  "dockVesselLengths",
  "otherWaterActivities",
]);

const CONTEXT_KEYS: string[] = [
  "town",
  "county",
  "waterbody",
  "corners",
  "generalDescription",
  "totalAcreage",
  "leaseTermYears",
  "cultureTypes",
  "cultureMethod",
  "isAboveMeanLowWater",
  "depthAtMeanLowWaterFt",
  "depthAtMeanHighWaterFt",
  "usesSuspendedGear",
  "hatcheryStock",
  "siteStock",
  "wildStock",
  "growingAreaDesignation",
  "growingAreaClassification",
  "mailingCity",
  "mailingState",
  "mailingZip",
  "inMarkedNavigationChannel",
  "isWithin1000FtOfShorefront",
  "riparianMunicipality",
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

/** Same mapping as the Experimental lease: location, term, and acreage carry. */
function seedDraft(profile: OperationProfile): StandardDraftApplication {
  return {
    ...EMPTY_STANDARD_DRAFT_APPLICATION,
    generalDescription: profile.locationDescription,
    leaseTermYears: profile.leaseDurationYears,
    totalAcreage:
      profile.siteAreaSqFt !== null
        ? Math.round((profile.siteAreaSqFt / SQ_FT_PER_ACRE) * 100) / 100
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* The definitions                                                             */
/* -------------------------------------------------------------------------- */

export const STANDARD_DRAFT_DEFINITION: LicenseDefinition = {
  id: "standard_draft",
  licenseType: LicenseType.STANDARD_LEASE,
  shortName: "Standard lease draft application",
  formTitle:
    "Maine DMR's Standard (non-discharge) Aquaculture Lease draft application, " +
    "the preliminary proposal that informs the public scoping session",

  sections: STANDARD_DRAFT_SECTIONS,
  fields: STANDARD_DRAFT_FIELDS,
  formSchema: StandardDraftFormSchema,
  emptyApplication: () => ({ ...EMPTY_STANDARD_DRAFT_APPLICATION }),
  editors: STANDARD_DRAFT_EDITORS,
  requirements: STANDARD_DRAFT_REQUIREMENTS,

  fieldAnswered,
  fieldHasContent,
  validate: validateDraftApplication,
  migrate: (stored) => migrateDraftApplication(stored) ?? { ...EMPTY_STANDARD_DRAFT_APPLICATION },
  seed: seedDraft,

  extractionOverrides: EXTRACTION_OVERRIDES,
  coercions: COERCIONS,
  askedAlone: DRAFT_ASKED_ALONE,

  narrativeKeys: DRAFT_NARRATIVE,
  plausibilityContextKeys: CONTEXT_KEYS,
  plausibilityContextParts: CONTEXT_PARTS,

  successor: {
    id: "standard_final",
    label: "Begin the final application",
    description:
      "The draft goes to DMR to be accepted as ready for scoping, and you hold a " +
      "public scoping session on it. After that comes the final application — the " +
      "$1,000 form that goes to public hearing. Beginning it carries every answer " +
      "the two forms share across, keeps this draft on record, and asks only what " +
      "the final form adds: your environmental observations, the itemized gear " +
      "table, and the existing-uses section.",
  },

  pdf: {
    formFile: "Standard_Lease_Draft_Application.pdf",
    downloadName: "Standard-lease-draft-application",
  },
};

export const STANDARD_FINAL_DEFINITION: LicenseDefinition = {
  id: "standard_final",
  licenseType: LicenseType.STANDARD_LEASE,
  // The final application is reached by advancing from a completed draft, not
  // from triage: a person starting out always files the draft first.
  seededByTriage: false,
  shortName: "Standard lease final application",
  formTitle:
    "Maine DMR's Standard (non-discharge) Aquaculture Lease final application, " +
    "submitted after the public scoping session and heard at a public hearing",

  sections: STANDARD_FINAL_SECTIONS,
  fields: STANDARD_FINAL_FIELDS,
  formSchema: StandardFinalFormSchema,
  emptyApplication: () => ({ ...EMPTY_STANDARD_FINAL_APPLICATION }),
  editors: STANDARD_FINAL_EDITORS,
  requirements: STANDARD_FINAL_REQUIREMENTS,

  fieldAnswered,
  fieldHasContent,
  validate: validateFinalApplication,
  migrate: (stored) => migrateFinalApplication(stored) ?? { ...EMPTY_STANDARD_FINAL_APPLICATION },
  // Reached by advancing from the draft; a triage seed would skip the draft
  // stage entirely, so a fresh final starts as empty as the form itself.
  seed: () => ({ ...EMPTY_STANDARD_FINAL_APPLICATION }),

  extractionOverrides: EXTRACTION_OVERRIDES,
  coercions: COERCIONS,
  askedAlone: FINAL_ASKED_ALONE,

  narrativeKeys: FINAL_NARRATIVE,
  plausibilityContextKeys: CONTEXT_KEYS,
  plausibilityContextParts: CONTEXT_PARTS,

  pdf: {
    formFile: "Standard_Lease_Final_Application.pdf",
    downloadName: "Standard-lease-final-application",
  },
};

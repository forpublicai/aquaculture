/**
 * The human-facing catalogs for the two Standard lease applications: what each
 * field is called, how to ask for it, and when it applies.
 *
 * One file, two catalogs. A question printed on both forms is defined once and
 * composed into both, in each form's own printed order — the same
 * define-once-under-one-key discipline as schema.ts, and for the same reason:
 * the draft-to-final carry-over is only safe because a shared key means the
 * same question.
 *
 * As with the Experimental form, the printed "Proposed Operations" section is
 * split into interview sections (operations, equipment, structures, vessels)
 * because extraction is scoped to one section per turn.
 */
import type { Section } from "../definition";

import type { StandardDraftApplication, StandardFinalApplication } from "./schema";

/** Either standard application, for predicates over the shared keys. */
export type AnyStandardApplication = Partial<StandardDraftApplication> &
  Partial<StandardFinalApplication>;

export interface StandardFieldDef {
  key: string;
  section: string;
  label: string;
  question: string;
  questionFor?(app: AnyStandardApplication): string | null;
  hint?: string;
  appliesWhen?(app: AnyStandardApplication): boolean;
  emptyListIsAnswer?: boolean;
  kind?: string;
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

const SHARED_SECTION_START: Section[] = [
  {
    id: "applicant",
    title: "Applicant information",
    blurb: "Who's applying, how DMR reaches you, and the fee.",
  },
  {
    id: "proposal",
    title: "Proposal information",
    blurb: "Where the site is, how big, and for how long.",
  },
  {
    id: "interagency",
    title: "Interagency review",
    blurb: "What the other state and federal reviewers need to know about the site.",
  },
];

const ENVIRONMENT_SECTION: Section = {
  id: "environment",
  title: "Environmental characterization",
  blurb: "Your own observations of the site, made between April 1 and November 15.",
};

const SHARED_SECTION_MIDDLE: Section[] = [
  {
    id: "stock_water",
    title: "Source of stock and water quality",
    blurb: "What you'll grow, where the stock comes from, and the water classification.",
  },
  {
    id: "operations",
    title: "Cultivation and on-site activity",
    blurb: "How you'll culture, what goes in the water, and your working rhythm.",
  },
  {
    id: "equipment",
    title: "Motorized equipment and lighting",
    blurb: "Engines, generators, noise and light, piece by piece.",
  },
  {
    id: "structures",
    title: "Floating structures and buildings",
    blurb: "Work floats, barges, sheds — anything built that sits on the site.",
  },
  {
    id: "vessels",
    title: "Vessels",
    blurb: "The boats that will service the site.",
  },
];

const EXISTING_USES_SECTION: Section = {
  id: "existing_uses",
  title: "Existing uses of the area",
  blurb: "What you've personally observed happening on and around the site.",
};

const SHARED_SECTION_END: Section[] = [
  {
    id: "other_sites",
    title: "Other aquaculture sites",
    blurb: "LPAs and leases inside or within 1,000 feet of the proposal.",
  },
  {
    id: "capability",
    title: "Operational capability",
    blurb: "Experience, compliance history, and cost estimates.",
  },
  {
    id: "riparian",
    title: "Riparian landowner notification",
    blurb: "Shorefront parcels within 1,000 feet, from municipal tax records.",
  },
  {
    id: "coordinates",
    title: "Site coordinates",
    blurb: "The corners of the site in decimal degrees, NW corner first, clockwise.",
  },
];

export const STANDARD_DRAFT_SECTIONS: Section[] = [
  ...SHARED_SECTION_START,
  ...SHARED_SECTION_MIDDLE,
  ...SHARED_SECTION_END,
];

export const STANDARD_FINAL_SECTIONS: Section[] = [
  ...SHARED_SECTION_START,
  ENVIRONMENT_SECTION,
  ...SHARED_SECTION_MIDDLE,
  EXISTING_USES_SECTION,
  ...SHARED_SECTION_END,
];

/* -------------------------------------------------------------------------- */
/* Shared predicates                                                           */
/* -------------------------------------------------------------------------- */

export function proposesGear(app: AnyStandardApplication): boolean {
  return app.cultureMethod !== "bottom_planting_only";
}

export function proposesBottomPlanting(app: AnyStandardApplication): boolean {
  return app.cultureMethod === "bottom_planting_only" || app.cultureMethod === "combination";
}

export function proposesFloatingStructure(app: AnyStandardApplication): boolean {
  return (app.floatingStructureTypes ?? []).length > 0;
}

export function usesSuspendedCulture(app: AnyStandardApplication): boolean {
  return (app.cultureTypes ?? []).includes("suspended") || app.usesSuspendedGear === true;
}

/* -------------------------------------------------------------------------- */
/* Shared field fragments, in printed order                                    */
/* -------------------------------------------------------------------------- */

const APPLICANT_FIELDS: StandardFieldDef[] = [
  {
    key: "applicantName",
    section: "applicant",
    label: "Legal name of applicant(s)",
    question: "What's the legal name of the applicant — you, or your company if it's applying?",
  },
  {
    key: "contactPerson",
    section: "applicant",
    label: "Contact person",
    question: "Who should DMR contact about this application?",
  },
  {
    key: "applicantEmail",
    section: "applicant",
    label: "Email",
    question: "What email address should DMR use?",
    hint: "Email is how DMR communicates about the application, so use one you monitor.",
  },
  {
    key: "applicantTelephone",
    section: "applicant",
    label: "Telephone",
    question: "And the best phone number?",
  },
  {
    key: "mailingStreet",
    section: "applicant",
    label: "Mailing street address",
    question: "What's your mailing street address?",
  },
  { key: "mailingCity", section: "applicant", label: "Mailing city", question: "Which city or town?" },
  { key: "mailingState", section: "applicant", label: "Mailing state", question: "Which state?" },
  { key: "mailingZip", section: "applicant", label: "Mailing ZIP", question: "And the ZIP code?" },
  {
    key: "physicalSameAsMailing",
    section: "applicant",
    label: "Physical address same as mailing",
    question: "Is your physical address the same as your mailing address?",
  },
  {
    key: "physicalStreet",
    section: "applicant",
    label: "Physical street address",
    question: "What's your physical street address?",
    appliesWhen: (app) => app.physicalSameAsMailing === false,
  },
  {
    key: "physicalCity",
    section: "applicant",
    label: "Physical city",
    question: "Which city or town is that in?",
    appliesWhen: (app) => app.physicalSameAsMailing === false,
  },
  {
    key: "physicalState",
    section: "applicant",
    label: "Physical state",
    question: "Which state?",
    appliesWhen: (app) => app.physicalSameAsMailing === false,
  },
  {
    key: "physicalZip",
    section: "applicant",
    label: "Physical ZIP",
    question: "And its ZIP code?",
    appliesWhen: (app) => app.physicalSameAsMailing === false,
  },
];

const PROPOSAL_FIELDS: StandardFieldDef[] = [
  { key: "town", section: "proposal", label: "Town", question: "Which town is the proposed site in?" },
  { key: "county", section: "proposal", label: "County", question: "And which county?" },
  {
    key: "waterbody",
    section: "proposal",
    label: "Waterbody",
    question: "What's the name of the waterbody?",
  },
  {
    key: "generalDescription",
    section: "proposal",
    label: "General description",
    question:
      "How would you describe where the site sits? A landmark or a bearing works, something like \"south of Hog Island\".",
  },
  {
    key: "totalAcreage",
    section: "proposal",
    label: "Total acreage requested",
    question: "How many acres are you requesting?",
    hint: "A maximum of 100 acres may be requested for a standard lease. Answer in acres.",
  },
  {
    key: "leaseTermYears",
    section: "proposal",
    label: "Lease term requested",
    question: "How long a lease term are you requesting, in years?",
    hint: "The maximum term for a standard lease is 20 years.",
  },
  {
    key: "cultureTypes",
    section: "proposal",
    label: "Type of culture",
    question:
      "Is your culture suspended (gear in the water and/or on the bottom), bottom culture with no gear, or both?",
  },
  {
    key: "isAboveMeanLowWater",
    section: "proposal",
    label: "Intertidal site",
    question: "Is any portion of the proposed site above mean low water, in the intertidal zone?",
    hint: "If yes, you'll need written permission from every riparian owner whose intertidal land you'd use, and possibly a municipal vote. Those come up under the attachments.",
  },
];

const INTERAGENCY_FIELDS: StandardFieldDef[] = [
  {
    key: "habitatDesignations",
    section: "interagency",
    label: "Habitat designations",
    question:
      "Is the site within any of these habitat designations: Essential Habitat (Roseate Tern or Piping Plover/Least Tern), a Shorebird Area, or Tidal Waterfowl and Wading Bird Habitat? Say none if it's clear of all three.",
    emptyListIsAnswer: true,
    hint: "MDIFW publishes maps of these designations if you're unsure.",
  },
  {
    key: "depthAtMeanHighWaterFt",
    section: "interagency",
    label: "Depth at MHW (ft)",
    question: "What's the water depth at mean high water, in feet?",
  },
  {
    key: "depthAtMeanLowWaterFt",
    section: "interagency",
    label: "Depth at MLW (ft)",
    question: "And at mean low water?",
  },
  {
    key: "usesSuspendedGear",
    section: "interagency",
    label: "Suspended gear",
    question: "Are you proposing to use any suspended gear?",
  },
  {
    key: "gearSubmergedAtAllTides",
    section: "interagency",
    label: "Gear submerged at all tides",
    question: "Will that gear be submerged, below the surface, at all tidal stages?",
    appliesWhen: (app) => app.usesSuspendedGear === true,
  },
  {
    key: "proposesPredatorNetting",
    section: "interagency",
    label: "Predator netting",
    question: "Are you proposing predator netting?",
  },
  {
    key: "nettingMeshSize",
    section: "interagency",
    label: "Netting mesh size",
    question: "What's the mesh size of the netting?",
    appliesWhen: (app) => app.proposesPredatorNetting === true,
  },
  {
    key: "nettingTwineSize",
    section: "interagency",
    label: "Netting twine size",
    question: "And the twine size?",
    appliesWhen: (app) => app.proposesPredatorNetting === true,
  },
  {
    key: "govtPropertiesWithin1000Ft",
    section: "interagency",
    label: "Government conserved lands, docks and beaches within 1,000 ft",
    question:
      "Within 1,000 feet of the site, is there any conserved land, docking facility, or beach owned by federal, state, or municipal government? If so, for each one I need its name, how far away it is in feet, which level of government owns it, and the name of that government entity. Say none if the site is clear of all three.",
    emptyListIsAnswer: true,
  },
  {
    key: "inMarkedNavigationChannel",
    section: "interagency",
    label: "In a marked channel",
    question: "Is any portion of the proposal within a marked navigational channel?",
  },
  {
    key: "distanceToNearestChannelFt",
    section: "interagency",
    label: "Distance to nearest channel (ft)",
    question: "How far is the proposal from the nearest marked navigational channel, in feet?",
    appliesWhen: (app) => app.inMarkedNavigationChannel === false,
  },
  {
    key: "nearFederalNavigationProject",
    section: "interagency",
    label: "Federal navigation project within 1,000 ft",
    question:
      "Is the proposed site within 1,000 feet of any federal navigation project or anchorage?",
  },
  {
    key: "federalNavigationProjectName",
    section: "interagency",
    label: "Which project or anchorage",
    question: "Which project or anchorage is that?",
    appliesWhen: (app) => app.nearFederalNavigationProject === true,
  },
];

/** Final only. */
const ENVIRONMENT_FIELDS: StandardFieldDef[] = [
  {
    key: "bottomCharacteristics",
    section: "environment",
    label: "Bottom characteristics",
    question: "Describe the bottom you observed at the proposed site.",
    hint: "Everything in this section except ice must come from observations made between April 1 and November 15. DMR won't accept observation dates outside that window.",
  },
  {
    key: "bottomObservationDate",
    section: "environment",
    label: "Bottom observed on",
    question: "When did you make that bottom observation?",
  },
  {
    key: "currentSpeed",
    section: "environment",
    label: "Current speed",
    question: "What's the speed of the current at the site?",
  },
  {
    key: "currentSpeedObservationDate",
    section: "environment",
    label: "Current speed observed on",
    question: "When did you observe that?",
  },
  {
    key: "currentDirection",
    section: "environment",
    label: "Current direction",
    question: "And the direction of the current?",
  },
  {
    key: "currentDirectionObservationDate",
    section: "environment",
    label: "Current direction observed on",
    question: "Observed on what date?",
  },
  {
    key: "faunaDescription",
    section: "environment",
    label: "Fauna observed",
    question: "What animals have you observed in the area?",
  },
  {
    key: "faunaObservationDate",
    section: "environment",
    label: "Fauna observed on",
    question: "When did you make those observations?",
  },
  {
    key: "floraDescription",
    section: "environment",
    label: "Flora observed",
    question: "And what plants have you observed?",
  },
  {
    key: "floraObservationDate",
    section: "environment",
    label: "Flora observed on",
    question: "Observed on what date?",
  },
  {
    key: "eelgrassWithinSite",
    section: "environment",
    label: "Eelgrass within the site",
    question: "Have you observed eelgrass within the boundaries of the proposed site?",
  },
  {
    key: "eelgrassWithinSiteDate",
    section: "environment",
    label: "Eelgrass (site) observed on",
    question: "When did you make that eelgrass observation?",
  },
  {
    key: "eelgrassWithinSiteMethod",
    section: "environment",
    label: "Eelgrass (site) method",
    question: "How did you observe it — viewing scope, dive, drone, something else?",
  },
  {
    key: "eelgrassWithin1000Ft",
    section: "environment",
    label: "Eelgrass within 1,000 ft",
    question: "Have you observed eelgrass within 1,000 feet of the proposed site?",
  },
  {
    key: "eelgrassWithin1000FtDate",
    section: "environment",
    label: "Eelgrass (1,000 ft) observed on",
    question: "When was that observation made?",
  },
  {
    key: "eelgrassWithin1000FtMethod",
    section: "environment",
    label: "Eelgrass (1,000 ft) method",
    question: "And by what method?",
  },
  {
    key: "iceFormationDescription",
    section: "environment",
    label: "Ice formation",
    question:
      "Describe ice formation during the winter months within the proposed boundaries. DMR wants data behind this: water temperature or ice-out dates over a ten-year period, or at least five years of observations from the harbormaster, shellfish warden, harbor committee, Marine Patrol, or the fishing community.",
    hint: "Writing just \"no ice observed\" will not be accepted as an answer.",
  },
];

const STOCK_WATER_FIELDS: StandardFieldDef[] = [
  {
    key: "hatcheryStock",
    section: "stock_water",
    label: "Hatchery / stock-list sources",
    question:
      "Which species are you sourcing from an approved shellfish hatchery or an entity on DMR's non-shellfish stock list? For each: the common name, Latin name, the source's name, and your stocking density. Say none if nothing comes from a hatchery.",
    emptyListIsAnswer: true,
  },
  {
    key: "siteStock",
    section: "stock_water",
    label: "Other aquaculture site sources",
    question:
      "Are you sourcing any species from another aquaculture site in coastal waters? For each: the common name, Latin name, the source site's ID and waterbody, the stock's original point of origin, and stocking density. Say none if not.",
    emptyListIsAnswer: true,
  },
  {
    key: "wildStock",
    section: "stock_water",
    label: "Wild stock",
    question:
      "Are you collecting any marine organisms from Maine's coastal waters for the site? For each: the common name, Latin name, the waterbody collected from, the licensed harvester's name, and stocking density. Say none if not.",
    emptyListIsAnswer: true,
  },
  {
    key: "intendsWholeOrRoeOnScallops",
    section: "stock_water",
    label: "Whole or roe-on scallops",
    question: "Do you intend to possess whole or roe-on scallops?",
    hint: "If yes, biotoxin testing must be conducted regularly at your expense; DMR asks you to contact DMRPublicHealthDiv@maine.gov to discuss your plans.",
  },
  {
    key: "growingAreaDesignation",
    section: "stock_water",
    label: "Growing area designation",
    question: "What's DMR's growing area designation for the site?",
    hint: "Look it up on DMR's shellfish closures and aquaculture map.",
  },
  {
    key: "growingAreaClassification",
    section: "stock_water",
    label: "Growing area classification",
    question:
      "How is that growing area classified: approved, conditionally approved, restricted, conditionally restricted, or prohibited?",
    hint: "If you're growing molluscan shellfish in anything other than approved waters, DMR asks you to contact DMRPublicHealthDiv@maine.gov.",
  },
  {
    key: "birdDeterrenceMeasures",
    section: "stock_water",
    label: "Bird deterrence measures",
    question:
      "Because you're proposing suspended culture, DMR needs your mitigation or deterrent measures for minimizing pollution from birds at the site. What will you do?",
    appliesWhen: usesSuspendedCulture,
  },
];

const CULTURE_METHOD_FIELD: StandardFieldDef = {
  key: "cultureMethod",
  section: "operations",
  label: "Cultivation method",
  question:
    "Will you culture with gear, by bottom planting only with no gear, or a combination of both?",
};

/** Draft only: gear in preliminary terms. */
const DRAFT_GEAR_FIELDS: StandardFieldDef[] = [
  {
    key: "gearLocation",
    section: "operations",
    label: "Gear location in the water",
    question:
      "Where will the gear sit in the water: floating on the surface, suspended below the surface, or a combination?",
    appliesWhen: proposesGear,
  },
  {
    key: "gearTypesDescription",
    section: "operations",
    label: "Gear types",
    question: "Describe the gear types you'll use to culture the proposed species.",
    appliesWhen: proposesGear,
    hint: "Preliminary detail is fine here. The final application asks for an itemized gear and moorings table.",
  },
];

/** Final only: the itemized table and bottom planting. */
const FINAL_GEAR_FIELDS: StandardFieldDef[] = [
  {
    key: "gearItems",
    section: "operations",
    label: "Gear and moorings",
    question:
      "List everything that will be deployed within the site: every gear type, longline, mooring, and buoy. For each I need its dimensions, dates of deployment, the maximum number on site, its color, and which species will be grown with it.",
    appliesWhen: proposesGear,
  },
  {
    key: "bottomPlantedSpecies",
    section: "operations",
    label: "Bottom-planted species",
    question: "Which species will be bottom planted?",
    appliesWhen: proposesBottomPlanting,
  },
  {
    key: "bottomPlantingAreas",
    section: "operations",
    label: "Bottom-planting areas",
    question: "Where on the site would bottom planting occur? If it's the entire site, say so.",
    appliesWhen: proposesBottomPlanting,
  },
];

const ONSITE_PRE_FIELDS: StandardFieldDef[] = [
  {
    key: "onSiteDaysOfWeek",
    section: "operations",
    label: "Days on site",
    question: "At maximum capacity, which days of the week do you anticipate being on the site?",
  },
  {
    key: "workStartTime",
    section: "operations",
    label: "Earliest start",
    question: "At maximum capacity, what's the earliest time of day you'd start work on the site?",
  },
  {
    key: "workEndTime",
    section: "operations",
    label: "Latest end",
    question: "And the latest time you'd end?",
  },
];

/** Final only. */
const SEEDING_FIELDS: StandardFieldDef[] = [
  {
    key: "seedingMonths",
    section: "operations",
    label: "Seeding months",
    question: "What months will seeding occur?",
  },
  {
    key: "maxSeedingDays",
    section: "operations",
    label: "Maximum seeding days",
    question: "What's the maximum number of days it will take to seed the site?",
  },
];

const ONSITE_POST_FIELDS: StandardFieldDef[] = [
  {
    key: "tendingDescription",
    section: "operations",
    label: "Tending and maintenance",
    question: "Describe your tending and maintenance activities.",
  },
  {
    key: "harvestMonths",
    section: "operations",
    label: "Harvest months",
    question: "What months will harvesting occur?",
  },
  {
    key: "harvestMethods",
    section: "operations",
    label: "Harvest methods",
    question: "How will you harvest each species? If you're using a drag, include its dimensions.",
  },
  {
    key: "hasSeasonalGearChanges",
    section: "operations",
    label: "Seasonal gear changes",
    question:
      "Are there any seasonal changes to gear deployment, like sinking cages for the winter?",
  },
  {
    key: "seasonalGearChangesDescription",
    section: "operations",
    label: "Seasonal changes described",
    question: "Describe those seasonal changes.",
    appliesWhen: (app) => app.hasSeasonalGearChanges === true,
  },
];

const EQUIPMENT_PRE_FIELDS: StandardFieldDef[] = [
  {
    key: "usesMotorizedEquipment",
    section: "equipment",
    label: "Motorized equipment",
    question: "Are you proposing to use motorized equipment on the lease?",
  },
  {
    key: "hasFixedNoiseSources",
    section: "equipment",
    label: "Fixed noise sources",
    question: "Are any of the noise sources fixed in place?",
    appliesWhen: (app) => app.usesMotorizedEquipment === true,
  },
  {
    key: "fixedNoiseDirectionPlan",
    section: "equipment",
    label: "Directing fixed noise",
    question:
      "What's your plan to direct that noise away from residences and areas of routine use on the adjacent land?",
    appliesWhen: (app) => app.hasFixedNoiseSources === true,
  },
  {
    key: "equipmentHasExteriorLighting",
    section: "equipment",
    label: "Exterior lighting",
    question: "Does any of the equipment have exterior lighting?",
    appliesWhen: (app) => app.usesMotorizedEquipment === true,
  },
];

/** Final only. */
const LIGHTING_GLARE_FIELD: StandardFieldDef = {
  key: "lightingGlareMeasures",
  section: "equipment",
  label: "Lighting glare measures",
  question:
    "What measures ensure the exterior lighting only illuminates the target area and reduces glare?",
  appliesWhen: (app) => app.equipmentHasExteriorLighting === true,
};

const LIGHT_MITIGATION_FIELD: StandardFieldDef = {
  key: "lightingMitigationMeasures",
  section: "equipment",
  label: "Light impact mitigation",
  question: "What measures would mitigate light impacts from the equipment?",
  appliesWhen: (app) => app.equipmentHasExteriorLighting === true,
};

const GENERATOR_PRE_FIELDS: StandardFieldDef[] = [
  {
    key: "usesGenerator",
    section: "equipment",
    label: "Generator",
    question: "Are you proposing to use a generator?",
  },
  {
    key: "generatorPurpose",
    section: "equipment",
    label: "Generator purpose",
    question: "What's the generator used for?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
];

/** Final only. */
const GENERATOR_FUEL_FIELDS: StandardFieldDef[] = [
  {
    key: "generatorFuel",
    section: "equipment",
    label: "Generator fuel",
    question: "What fuel does it take: gasoline, diesel, or something else?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
  {
    key: "generatorFuelOther",
    section: "equipment",
    label: "Other fuel",
    question: "What fuel is it?",
    appliesWhen: (app) => app.generatorFuel === "other",
  },
];

const GENERATOR_POST_FIELDS: StandardFieldDef[] = [
  {
    key: "generatorMonths",
    section: "equipment",
    label: "Generator months",
    question: "Which months would you use the generator? If year-round, say so.",
    appliesWhen: (app) => app.usesGenerator === true,
  },
  {
    key: "generatorMaxDaysPerYear",
    section: "equipment",
    label: "Generator days per year",
    question: "What's the maximum number of days a year it would run?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
  {
    key: "generatorDaysOfWeek",
    section: "equipment",
    label: "Generator days of week",
    question: "Which days of the week?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
  {
    key: "generatorMaxHoursPerDay",
    section: "equipment",
    label: "Generator hours per day",
    question: "And the maximum hours a day?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
  {
    key: "generatorNoiseMitigatingDesign",
    section: "equipment",
    label: "Noise-mitigating generator",
    question: "Is the generator itself designed to mitigate noise?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
  {
    key: "generatorNoiseMitigation",
    section: "equipment",
    label: "Generator noise measures",
    question: "What measures will you take to mitigate noise from the generator?",
    appliesWhen: (app) => app.usesGenerator === true,
  },
];

const EQUIPMENT_TABLE_FIELD: StandardFieldDef = {
  key: "motorizedEquipment",
  section: "equipment",
  label: "Motorized equipment list",
  question:
    "Now each piece of motorized equipment, excluding vessels. For each: what it is, what it's used for, its color, whether it has exterior lights, how it's powered, which months and days it would be used, the maximum days per year and hours per day, and how you'd mitigate its noise.",
  appliesWhen: (app) => app.usesMotorizedEquipment === true,
};

const FLOATING_PRE_FIELDS: StandardFieldDef[] = [
  {
    key: "floatingStructureTypes",
    section: "structures",
    label: "Floating structures",
    question:
      "Are you proposing a work float, a barge, or another floating structure? Say none if you aren't proposing any.",
    emptyListIsAnswer: true,
  },
  {
    key: "floatingStructureOtherNote",
    section: "structures",
    label: "Other structure",
    question: "What kind of structure is it?",
    appliesWhen: (app) => (app.floatingStructureTypes ?? []).includes("other"),
  },
  {
    key: "floatingStructureMonths",
    section: "structures",
    label: "Structure months on site",
    question: "Which months will the structure be within the site boundaries?",
    appliesWhen: proposesFloatingStructure,
  },
  {
    key: "floatingStructurePurpose",
    section: "structures",
    label: "Structure purpose",
    question: "What's the structure for?",
    appliesWhen: proposesFloatingStructure,
  },
  {
    key: "floatingStructureLengthWidthFt",
    section: "structures",
    label: "Structure length and width",
    question: "What are its length and width, in feet?",
    appliesWhen: proposesFloatingStructure,
  },
];

/** Final only. */
const FLOATING_DETAIL_FIELDS: StandardFieldDef[] = [
  {
    key: "floatingStructureHeightFt",
    section: "structures",
    label: "Structure height (ft)",
    question: "And its height, measured from the water line?",
    appliesWhen: proposesFloatingStructure,
  },
  {
    key: "floatingStructureMaterials",
    section: "structures",
    label: "Structure materials",
    question: "What's it built from?",
    appliesWhen: proposesFloatingStructure,
  },
];

const FLOATING_COLOR_FIELD: StandardFieldDef = {
  key: "floatingStructureColor",
  section: "structures",
  label: "Structure color",
  question: "What color is it: grays, blacks, browns, blues, or greens?",
  appliesWhen: proposesFloatingStructure,
};

const FLOATING_LIGHTING_FIELD: StandardFieldDef = {
  key: "floatingStructureHasLighting",
  section: "structures",
  label: "Structure lighting",
  question: "Does the structure have exterior lighting?",
  appliesWhen: proposesFloatingStructure,
};

/** Final only. */
const FLOATING_GLARE_FIELD: StandardFieldDef = {
  key: "floatingStructureGlareMeasures",
  section: "structures",
  label: "Structure glare measures",
  question: "What measures keep that lighting on the target area and reduce glare?",
  appliesWhen: (app) => app.floatingStructureHasLighting === true,
};

const FLOATING_LIGHT_MITIGATION_FIELD: StandardFieldDef = {
  key: "floatingStructureLightMitigation",
  section: "structures",
  label: "Structure light mitigation",
  question: "What would you do to mitigate light impacts from the structure?",
  appliesWhen: (app) => app.floatingStructureHasLighting === true,
};

const BUILDING_PRE_FIELDS: StandardFieldDef[] = [
  {
    key: "proposesBuilding",
    section: "structures",
    label: "Building or shed",
    question: "Are you proposing a shed, building, or similar structure?",
  },
  {
    key: "buildingPurpose",
    section: "structures",
    label: "Building purpose",
    question: "What's the building used for?",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
  {
    key: "buildingMaxDaysPerYear",
    section: "structures",
    label: "Building days per year",
    question:
      "What's the maximum number of days it would be within the site each year? Year-round counts as 365.",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
  {
    key: "buildingLengthWidthFt",
    section: "structures",
    label: "Building length and width",
    question: "Its length and width, in feet?",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
  {
    key: "buildingHeightFt",
    section: "structures",
    label: "Building height (ft)",
    question: "And its height from the waterline?",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
];

/** Final only. */
const BUILDING_MATERIAL_FIELDS: StandardFieldDef[] = [
  {
    key: "buildingRoofingMaterials",
    section: "structures",
    label: "Roofing materials",
    question: "What are the roofing materials? They can't be reflective or glossy.",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
  {
    key: "buildingSidingMaterials",
    section: "structures",
    label: "Siding materials",
    question: "And the siding materials, also not reflective or glossy?",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
];

const BUILDING_POST_FIELDS: StandardFieldDef[] = [
  {
    key: "buildingColor",
    section: "structures",
    label: "Building color",
    question: "What color is the building: grays, blacks, browns, blues, or greens?",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
  {
    key: "buildingVisualImpactMeasures",
    section: "structures",
    label: "Visual impact measures",
    question: "What would you do to minimize its visual impact as seen from the water?",
    appliesWhen: (app) => app.proposesBuilding === true,
  },
];

const VESSELS_FIELD: StandardFieldDef = {
  key: "vessels",
  section: "vessels",
  label: "Vessels",
  question:
    "Which vessels may service the site? For each: the type of vessel, engine type and horsepower, its length in feet, its height from the waterline, how many days a year it would service the site, and how many hours a day it would be there.",
};

/** Final only. */
const LAUNCH_FIELDS: StandardFieldDef[] = [
  {
    key: "launchSites",
    section: "vessels",
    label: "Launch sites",
    question:
      "Where will the service vessels launch from: a public boat launch, private property you own, or somewhere else? All that apply.",
  },
  {
    key: "launchSiteOtherNote",
    section: "vessels",
    label: "Other launch site",
    question: "Where is that?",
    appliesWhen: (app) => (app.launchSites ?? []).includes("other"),
  },
];

const PETROLEUM_FIELD: StandardFieldDef = {
  key: "storesPetroleumOnSite",
  section: "vessels",
  label: "Petroleum on site",
  question: "Will you store petroleum products on the proposed site?",
  hint: "If yes, a spill prevention and control plan has to be attached to the application.",
};

/** Final only: the whole existing-uses section. */
const EXISTING_USES_FIELDS: StandardFieldDef[] = [
  {
    key: "commercialNavObservationMonths",
    section: "existing_uses",
    label: "Commercial navigation observed (months)",
    question:
      "This next section is about what you've personally observed in the area. First, commercial vessel traffic: in which month(s) did you complete those observations?",
  },
  {
    key: "commercialNavObservationYears",
    section: "existing_uses",
    label: "Commercial navigation observed (years)",
    question: "And in which year(s)?",
  },
  {
    key: "commercialNavVesselTypes",
    section: "existing_uses",
    label: "Commercial vessel types",
    question: "What types of commercial vessels did you observe navigating in the area?",
  },
  {
    key: "commercialNavVesselLength",
    section: "existing_uses",
    label: "Commercial vessel length",
    question: "Roughly how long were they, in feet?",
  },
  {
    key: "commercialNavVesselCount",
    section: "existing_uses",
    label: "Commercial vessel count",
    question: "How many commercial vessels did you observe?",
  },
  {
    key: "commercialNavTransitsSite",
    section: "existing_uses",
    label: "Commercial transits through site",
    question: "Did any commercial vessels transit through the boundaries of the proposed site?",
  },
  {
    key: "commercialNavTransitCount",
    section: "existing_uses",
    label: "How many transited",
    question: "How many transited through?",
    appliesWhen: (app) => app.commercialNavTransitsSite === true,
  },
  {
    key: "commercialNavTrafficDirection",
    section: "existing_uses",
    label: "Commercial traffic direction",
    question: "What's the typical direction of commercial vessel traffic?",
  },
  {
    key: "recreationalNavObservationMonths",
    section: "existing_uses",
    label: "Recreational navigation observed (months)",
    question: "Now recreational vessels: in which month(s) did you observe them?",
  },
  {
    key: "recreationalNavObservationYears",
    section: "existing_uses",
    label: "Recreational navigation observed (years)",
    question: "Which year(s)?",
  },
  {
    key: "recreationalNavVesselTypes",
    section: "existing_uses",
    label: "Recreational vessel types",
    question: "What types of recreational vessels did you observe?",
  },
  {
    key: "recreationalNavVesselSize",
    section: "existing_uses",
    label: "Recreational vessel size",
    question: "Roughly what size were they?",
  },
  {
    key: "recreationalNavVesselCount",
    section: "existing_uses",
    label: "Recreational vessel count",
    question: "How many did you observe?",
  },
  {
    key: "recreationalNavTransitsSite",
    section: "existing_uses",
    label: "Recreational transits through site",
    question: "Did any recreational vessels transit through the proposed boundaries?",
  },
  {
    key: "recreationalNavTransitCount",
    section: "existing_uses",
    label: "How many transited",
    question: "How many?",
    appliesWhen: (app) => app.recreationalNavTransitsSite === true,
  },
  {
    key: "recreationalNavTrafficDirection",
    section: "existing_uses",
    label: "Recreational traffic direction",
    question: "And the typical direction of recreational traffic?",
  },
  {
    key: "mooringsObservationMonths",
    section: "existing_uses",
    label: "Moorings observed (months)",
    question: "On to moorings: in which month(s) did you observe the moorings in the area?",
  },
  {
    key: "mooringsObservationYears",
    section: "existing_uses",
    label: "Moorings observed (years)",
    question: "Which year(s)?",
  },
  {
    key: "hasMooringsInVicinity",
    section: "existing_uses",
    label: "Moorings in the vicinity",
    question: "Are there any moorings in the vicinity of the proposed lease site?",
  },
  {
    key: "mooringsWithin1000FtCount",
    section: "existing_uses",
    label: "Moorings within 1,000 ft",
    question: "How many moorings are within 1,000 feet of the site?",
    appliesWhen: (app) => app.hasMooringsInVicinity === true,
  },
  {
    key: "mooringVesselTypes",
    section: "existing_uses",
    label: "Mooring vessel types",
    question: "Do commercial vessels, recreational vessels, or both use those moorings?",
    appliesWhen: (app) => app.hasMooringsInVicinity === true,
  },
  {
    key: "mooringClosestDistanceFt",
    section: "existing_uses",
    label: "Closest mooring (ft)",
    question: "How far, in feet, is the closest observed mooring from the proposed site?",
    appliesWhen: (app) => app.hasMooringsInVicinity === true,
  },
  {
    key: "mooringVesselLengthFt",
    section: "existing_uses",
    label: "Vessel on closest mooring (ft)",
    question: "How long is the vessel that uses that mooring, in feet?",
    appliesWhen: (app) => app.hasMooringsInVicinity === true,
  },
  {
    key: "commercialFishingObservationMonths",
    section: "existing_uses",
    label: "Commercial fishing observed (months)",
    question: "Commercial fishing next: in which month(s) did you complete those observations?",
  },
  {
    key: "commercialFishingObservationYears",
    section: "existing_uses",
    label: "Commercial fishing observed (years)",
    question: "Which year(s)?",
  },
  {
    key: "commercialFishingWithinSite",
    section: "existing_uses",
    label: "Commercial fishing within site",
    question: "Does any commercial fishing occur within the boundaries of the proposed site?",
  },
  {
    key: "commercialFishingWithinSiteTypes",
    section: "existing_uses",
    label: "Types within site",
    question: "What types of commercial fishing occur within the boundaries?",
    appliesWhen: (app) => app.commercialFishingWithinSite === true,
  },
  {
    key: "commercialFishingWithinSiteMonths",
    section: "existing_uses",
    label: "Months within site",
    question: "In which months?",
    appliesWhen: (app) => app.commercialFishingWithinSite === true,
  },
  {
    key: "commercialFishingWithinSitePeople",
    section: "existing_uses",
    label: "People fishing within site",
    question: "How many people commercially fish within the proposed lease area?",
    appliesWhen: (app) => app.commercialFishingWithinSite === true,
  },
  {
    key: "commercialFishingInVicinity",
    section: "existing_uses",
    label: "Commercial fishing in vicinity",
    question: "Does any commercial fishing occur in the vicinity of the site?",
  },
  {
    key: "commercialFishingVicinityTypes",
    section: "existing_uses",
    label: "Types in vicinity",
    question: "What types?",
    appliesWhen: (app) => app.commercialFishingInVicinity === true,
  },
  {
    key: "commercialFishingVicinityMonths",
    section: "existing_uses",
    label: "Months in vicinity",
    question: "Which months?",
    appliesWhen: (app) => app.commercialFishingInVicinity === true,
  },
  {
    key: "commercialFishingVicinityPeople",
    section: "existing_uses",
    label: "People fishing in vicinity",
    question: "How many people fish commercially in the vicinity?",
    appliesWhen: (app) => app.commercialFishingInVicinity === true,
  },
  {
    key: "recreationalFishingObservationMonths",
    section: "existing_uses",
    label: "Recreational fishing observed (months)",
    question: "Same again for recreational fishing: which month(s) were your observations in?",
  },
  {
    key: "recreationalFishingObservationYears",
    section: "existing_uses",
    label: "Recreational fishing observed (years)",
    question: "Which year(s)?",
  },
  {
    key: "recreationalFishingWithinSite",
    section: "existing_uses",
    label: "Recreational fishing within site",
    question: "Does any recreational fishing occur within the proposed boundaries?",
  },
  {
    key: "recreationalFishingWithinSiteTypes",
    section: "existing_uses",
    label: "Types within site",
    question: "What types?",
    appliesWhen: (app) => app.recreationalFishingWithinSite === true,
  },
  {
    key: "recreationalFishingWithinSiteMonths",
    section: "existing_uses",
    label: "Months within site",
    question: "In which months?",
    appliesWhen: (app) => app.recreationalFishingWithinSite === true,
  },
  {
    key: "recreationalFishingWithinSitePeople",
    section: "existing_uses",
    label: "People fishing within site",
    question: "How many people recreationally fish within the lease area?",
    appliesWhen: (app) => app.recreationalFishingWithinSite === true,
  },
  {
    key: "recreationalFishingInVicinity",
    section: "existing_uses",
    label: "Recreational fishing in vicinity",
    question: "Does any recreational fishing occur in the vicinity?",
  },
  {
    key: "recreationalFishingVicinityTypes",
    section: "existing_uses",
    label: "Types in vicinity",
    question: "What types?",
    appliesWhen: (app) => app.recreationalFishingInVicinity === true,
  },
  {
    key: "recreationalFishingVicinityMonths",
    section: "existing_uses",
    label: "Months in vicinity",
    question: "Which months?",
    appliesWhen: (app) => app.recreationalFishingInVicinity === true,
  },
  {
    key: "recreationalFishingVicinityPeople",
    section: "existing_uses",
    label: "People fishing in vicinity",
    question: "How many people?",
    appliesWhen: (app) => app.recreationalFishingInVicinity === true,
  },
  {
    key: "riparianObservationMonths",
    section: "existing_uses",
    label: "Shoreline access observed (months)",
    question:
      "Now the shoreline: in which month(s) did you observe riparian ingress and egress — landowners coming and going from shore?",
  },
  {
    key: "riparianObservationYears",
    section: "existing_uses",
    label: "Shoreline access observed (years)",
    question: "Which year(s)?",
  },
  {
    key: "shorelineDescription",
    section: "existing_uses",
    label: "Shoreline description",
    question: "Describe the shoreline in the vicinity of the proposal.",
  },
  {
    key: "observedRiparianVessels",
    section: "existing_uses",
    label: "Riparian vessels observed",
    question: "Have you observed any riparian-owned vessels accessing the shoreline?",
  },
  {
    key: "riparianVesselTypes",
    section: "existing_uses",
    label: "Riparian vessel types",
    question: "What type of vessels were they?",
    appliesWhen: (app) => app.observedRiparianVessels === true,
  },
  {
    key: "riparianVesselLengths",
    section: "existing_uses",
    label: "Riparian vessel lengths",
    question: "And roughly how long, in feet?",
    appliesWhen: (app) => app.observedRiparianVessels === true,
  },
  {
    key: "uplandsDescription",
    section: "existing_uses",
    label: "Surrounding uplands",
    question:
      "Describe the surrounding uplands in the vicinity: forested, residential, farmland, commercial?",
  },
  {
    key: "hasDocksInArea",
    section: "existing_uses",
    label: "Docks in the area",
    question: "Are there any docks in the area?",
  },
  {
    key: "docksWithin1000FtCount",
    section: "existing_uses",
    label: "Docks within 1,000 ft",
    question: "How many are within 1,000 feet of the proposed site?",
    appliesWhen: (app) => app.hasDocksInArea === true,
  },
  {
    key: "observedVesselsAtDocks",
    section: "existing_uses",
    label: "Vessels at the docks",
    question: "Have you observed vessels accessing or secured to those docks?",
    appliesWhen: (app) => app.hasDocksInArea === true,
  },
  {
    key: "dockVesselLengths",
    section: "existing_uses",
    label: "Dock vessel lengths",
    question: "How long were the vessels you observed, in feet?",
    appliesWhen: (app) => app.observedVesselsAtDocks === true,
  },
  {
    key: "closestDockDistanceFt",
    section: "existing_uses",
    label: "Closest dock (ft)",
    question: "How far is the closest observed dock from the proposed site, in feet?",
    appliesWhen: (app) => app.hasDocksInArea === true,
  },
  {
    key: "otherWaterActivities",
    section: "existing_uses",
    label: "Other water uses",
    question:
      "Do kayaking, swimming, or any other water activities occur in the vicinity of the site? For each: the month(s) you observed it, how many people or vessels were engaged in it, and whether it happens within the proposal boundaries, in the vicinity, or both. Say none if you've observed none of these.",
    emptyListIsAnswer: true,
  },
];

const OTHER_SITES_FIELDS: StandardFieldDef[] = [
  {
    key: "lpaWithinSite",
    section: "other_sites",
    label: "LPAs within the site",
    question: "Are there any LPA licenses within the boundaries of the proposed site?",
  },
  {
    key: "lpaWithinSiteIds",
    section: "other_sites",
    label: "Their LPA site IDs",
    question: "What are their LPA site IDs?",
    appliesWhen: (app) => app.lpaWithinSite === true,
  },
  {
    key: "lpaWithin1000Ft",
    section: "other_sites",
    label: "LPAs within 1,000 ft",
    question: "Any LPA sites within 1,000 feet of the boundaries?",
  },
  {
    key: "lpaWithin1000FtIds",
    section: "other_sites",
    label: "Their LPA site IDs",
    question: "Which site IDs?",
    appliesWhen: (app) => app.lpaWithin1000Ft === true,
  },
  {
    key: "experimentalWithinSite",
    section: "other_sites",
    label: "Experimental leases within the site",
    question: "Is any portion of an experimental lease within the boundaries?",
  },
  {
    key: "experimentalWithinSiteIds",
    section: "other_sites",
    label: "Their lease site IDs",
    question: "Which experimental lease site IDs?",
    appliesWhen: (app) => app.experimentalWithinSite === true,
  },
  {
    key: "experimentalWithin1000Ft",
    section: "other_sites",
    label: "Experimental leases within 1,000 ft",
    question: "Any experimental lease within 1,000 feet?",
  },
  {
    key: "experimentalWithin1000FtIds",
    section: "other_sites",
    label: "Their lease site IDs",
    question: "Which site IDs?",
    appliesWhen: (app) => app.experimentalWithin1000Ft === true,
  },
  {
    key: "standardWithinSite",
    section: "other_sites",
    label: "Standard leases within the site",
    question: "Is any portion of a standard lease within the boundaries?",
  },
  {
    key: "standardWithinSiteIds",
    section: "other_sites",
    label: "Their lease site IDs",
    question: "Which standard lease site IDs?",
    appliesWhen: (app) => app.standardWithinSite === true,
  },
  {
    key: "standardWithin1000Ft",
    section: "other_sites",
    label: "Standard leases within 1,000 ft",
    question: "And any standard lease within 1,000 feet?",
  },
  {
    key: "standardWithin1000FtIds",
    section: "other_sites",
    label: "Their lease site IDs",
    question: "Which site IDs?",
    appliesWhen: (app) => app.standardWithin1000Ft === true,
  },
];

const CAPABILITY_FIELDS: StandardFieldDef[] = [
  {
    key: "holdsOtherAquacultureSites",
    section: "capability",
    label: "Existing aquaculture sites",
    question: "Do you, or any co-applicant, hold existing aquaculture sites?",
  },
  {
    key: "existingSites",
    section: "capability",
    label: "Sites held",
    question:
      "For each site held: the holder's name, whether it's an experimental lease, standard lease, or LPA, its site ID, and — for leases only — its acreage.",
    appliesWhen: (app) => app.holdsOtherAquacultureSites === true,
  },
  {
    key: "waterExperience",
    section: "capability",
    label: "Experience on the water",
    question: "Tell me about your skills and experience working on the water.",
  },
  {
    key: "convictedOfMarineViolation",
    section: "capability",
    label: "Marine resource convictions",
    question: "Have you been convicted of violating any state or federal marine resource laws?",
  },
  {
    key: "adjudicatedMarineViolation",
    section: "capability",
    label: "Marine resource adjudications",
    question:
      "Have you been adjudicated to be responsible for violating any state or federal marine resource laws?",
  },
  {
    key: "annualLeaseRent",
    section: "capability",
    label: "Annual lease rent",
    question: "What do you estimate for annual lease rent?",
    hint: "Rent is $100 per acre, so multiply your requested acreage by $100.",
  },
  {
    key: "annualLicensingFees",
    section: "capability",
    label: "Annual DMR licensing fees",
    question: "And annual DMR licensing fees?",
    hint: "If you'll remove, transport or sell what you grow, you'll need the aquaculture harvest license, renewed each year.",
  },
  {
    key: "annualBondOrEscrowCost",
    section: "capability",
    label: "Bond or escrow",
    question:
      "What's your estimate for the annual bond cost, or the escrow amount you'd commit?",
    hint: "Bottom-only culture needs no bond. Gear on 400 square feet or less needs $1,500; gear on more than that needs $5,000. A bond is an annual premium through an insurer; escrow is the full amount held at a bank.",
  },
  {
    key: "annualEquipmentCosts",
    section: "capability",
    label: "Annual equipment costs",
    question: "Estimated annual equipment costs?",
    hint: "Even with no gear, the site still has to be marked in accordance with regulation.",
  },
  {
    key: "annualMaintenanceCosts",
    section: "capability",
    label: "Annual maintenance costs",
    question: "And estimated annual maintenance costs?",
  },
];

const RIPARIAN_FIELDS: StandardFieldDef[] = [
  {
    key: "isWithin1000FtOfShorefront",
    section: "riparian",
    label: "Shorefront within 1,000 ft",
    question:
      "Is the proposal within 1,000 feet of shorefront land? Shorefront extends to mean low water or 1,650 feet from shore, whichever is less, according to NOAA charts.",
  },
  {
    key: "riparianMunicipality",
    section: "riparian",
    label: "Municipality",
    question: "Which municipality's tax records will the riparian landowner list come from?",
    hint: "If the site spans more than one municipality, DMR wants a separate certified list for each.",
    appliesWhen: (app) => app.isWithin1000FtOfShorefront === true,
  },
  {
    key: "riparianLandowners",
    section: "riparian",
    label: "Riparian landowners",
    question:
      "List the shorefront parcels within 1,000 feet: for each, the tax map number, lot number, the landowner's name, and their mailing address from the town's records.",
    hint: "The municipality certifies this list — typically the town clerk or tax assessor — so it has to match their records exactly.",
    appliesWhen: (app) => app.isWithin1000FtOfShorefront === true,
  },
  {
    key: "municipalityHasShellfishProgram",
    section: "riparian",
    label: "Municipal shellfish program",
    question:
      "Does the municipality have a shellfish conservation program under 12 M.R.S.A. §6671?",
    hint: "For an intertidal site in a town with a program, the municipal officials must vote to consent to your use of the intertidal area, and you submit the meeting minutes or a summary letter.",
    appliesWhen: (app) => app.isAboveMeanLowWater === true,
  },
];

const CORNERS_FIELD: StandardFieldDef = {
  key: "corners",
  section: "coordinates",
  label: "Corner coordinates",
  question:
    "Now the corners of the site, in decimal degrees, WGS-84. Start with the northwest corner and go clockwise. Coordinates straight off a plotter or phone are fine, like 43°39'02.2\"N 70°11'16.2\"W — I'll convert them.",
  hint: "The boundary drawing you attach has to label the corners in the same order, corner 1 at the NW.",
};

/* -------------------------------------------------------------------------- */
/* The two catalogs                                                            */
/* -------------------------------------------------------------------------- */

export const STANDARD_DRAFT_FIELDS: StandardFieldDef[] = [
  ...APPLICANT_FIELDS,
  {
    key: "paymentType",
    section: "applicant",
    label: "Payment method",
    question: "Will you pay the $500 draft-application fee by check or credit card?",
    hint: "Paying by check means mailing the application with the check, payable to \"Treasurer State of Maine\". Choosing credit card lets you mail or email the application, and DMR will contact you for payment; never include card details. The fee is non-refundable.",
  },
  {
    key: "preApplicationMeetingDate",
    section: "applicant",
    label: "Pre-application meeting date",
    question: "When was your pre-application meeting with DMR held?",
    hint: "The draft application is submitted after a pre-application meeting with DMR and, typically, your harbormaster or a municipal official. If you haven't had one, schedule it before going further.",
  },
  ...PROPOSAL_FIELDS,
  ...INTERAGENCY_FIELDS,
  ...STOCK_WATER_FIELDS,
  CULTURE_METHOD_FIELD,
  ...DRAFT_GEAR_FIELDS,
  ...ONSITE_PRE_FIELDS,
  ...ONSITE_POST_FIELDS,
  ...EQUIPMENT_PRE_FIELDS,
  LIGHT_MITIGATION_FIELD,
  ...GENERATOR_PRE_FIELDS,
  ...GENERATOR_POST_FIELDS,
  EQUIPMENT_TABLE_FIELD,
  ...FLOATING_PRE_FIELDS,
  FLOATING_COLOR_FIELD,
  FLOATING_LIGHTING_FIELD,
  FLOATING_LIGHT_MITIGATION_FIELD,
  ...BUILDING_PRE_FIELDS,
  ...BUILDING_POST_FIELDS,
  VESSELS_FIELD,
  PETROLEUM_FIELD,
  ...OTHER_SITES_FIELDS,
  ...CAPABILITY_FIELDS,
  ...RIPARIAN_FIELDS,
  CORNERS_FIELD,
];

export const STANDARD_FINAL_FIELDS: StandardFieldDef[] = [
  ...APPLICANT_FIELDS,
  {
    key: "paymentType",
    section: "applicant",
    label: "Payment method",
    question: "Will you pay the $1,000 final-application fee by check or credit card?",
    hint: "Paying by check means mailing the application with the check, payable to \"Treasurer State of Maine\". Choosing credit card lets you mail or email the application, and DMR will contact you for payment; never include card details. The fee is non-refundable.",
  },
  {
    key: "scopingSessionDate",
    section: "applicant",
    label: "Scoping session date",
    question: "When was the public scoping session on your draft application held?",
    hint: "The final application is submitted after the scoping session, and should reflect what you heard there.",
  },
  ...PROPOSAL_FIELDS,
  ...INTERAGENCY_FIELDS,
  ...ENVIRONMENT_FIELDS,
  ...STOCK_WATER_FIELDS,
  CULTURE_METHOD_FIELD,
  ...FINAL_GEAR_FIELDS,
  ...ONSITE_PRE_FIELDS,
  ...SEEDING_FIELDS,
  ...ONSITE_POST_FIELDS,
  ...EQUIPMENT_PRE_FIELDS,
  LIGHTING_GLARE_FIELD,
  LIGHT_MITIGATION_FIELD,
  ...GENERATOR_PRE_FIELDS,
  ...GENERATOR_FUEL_FIELDS,
  ...GENERATOR_POST_FIELDS,
  EQUIPMENT_TABLE_FIELD,
  ...FLOATING_PRE_FIELDS,
  ...FLOATING_DETAIL_FIELDS,
  FLOATING_COLOR_FIELD,
  FLOATING_LIGHTING_FIELD,
  FLOATING_GLARE_FIELD,
  FLOATING_LIGHT_MITIGATION_FIELD,
  ...BUILDING_PRE_FIELDS,
  ...BUILDING_MATERIAL_FIELDS,
  ...BUILDING_POST_FIELDS,
  VESSELS_FIELD,
  ...LAUNCH_FIELDS,
  PETROLEUM_FIELD,
  ...EXISTING_USES_FIELDS,
  ...OTHER_SITES_FIELDS,
  ...CAPABILITY_FIELDS,
  ...RIPARIAN_FIELDS,
  CORNERS_FIELD,
];

/* -------------------------------------------------------------------------- */
/* Answeredness — the generic rules; neither form has composite special cases  */
/* -------------------------------------------------------------------------- */

export function fieldAnswered(
  field: StandardFieldDef,
  app: Record<string, unknown>
): boolean {
  const value = app[field.key];
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return field.emptyListIsAnswer ? true : value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

export function fieldHasContent(
  field: StandardFieldDef,
  app: Record<string, unknown>
): boolean {
  const value = app[field.key];
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0 || Boolean(field.emptyListIsAnswer);
  if (typeof value === "object") {
    return Object.values(value).some((part) => part !== null && part !== "");
  }
  return true;
}

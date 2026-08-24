/**
 * How each Standard lease field is edited by hand on the review screen.
 *
 * Two maps, one per form, composed from shared fragments the same way the
 * schemas are. Each map is annotated `Record<FormKey, Control>`, so adding a
 * field to either form schema fails the typecheck until it has a control.
 *
 * Note the standard forms print five color families with no "Other" line, so
 * the color dropdowns here are shorter than the Experimental form's.
 */
import { choicesFrom, type Control, type RecordPart } from "../controls";

import {
  ActivityLocation,
  AquacultureSiteType,
  CultureMethod,
  CultureType,
  EquipmentColor,
  FloatingStructureType,
  GearLocation,
  GeneratorFuel,
  GovtPropertyKind,
  GrowingAreaClassification,
  HabitatDesignation,
  LaunchSite,
  MooringVesselType,
  OtherWaterActivity,
  PaymentType,
  type StandardDraftFormKey,
  type StandardFinalFormKey,
} from "./schema";

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  check: "Check enclosed with the mailed application",
  credit_card: "DMR will contact me for card details",
};

const CULTURE_TYPE_LABELS: Record<string, string> = {
  suspended: "Suspended (gear in the water and/or on the bottom)",
  bottom: "Bottom (no gear)",
};

const HABITAT_LABELS: Record<string, string> = {
  essential_habitat: "Essential Habitat (Roseate Tern, Piping Plover/Least Tern)",
  shorebird_area: "Shorebird Area",
  tidal_waterfowl_wading_bird: "Tidal Waterfowl and Wading Bird Habitat",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  approved: "Approved",
  conditionally_approved: "Conditionally Approved",
  restricted: "Restricted",
  conditionally_restricted: "Conditionally Restricted",
  prohibited: "Prohibited",
};

const CULTURE_METHOD_LABELS: Record<string, string> = {
  gear_only: "Gear",
  bottom_planting_only: "Bottom planting only (no gear proposed)",
  combination: "Combination: both gear and bottom planting",
};

const GEAR_LOCATION_LABELS: Record<string, string> = {
  floating: "Floating on the surface of the water",
  suspended_below: "Suspended below the surface of the water",
  combination: "Combination: floating and suspended below the surface",
};

const GENERATOR_FUEL_LABELS: Record<string, string> = {
  gasoline: "Gasoline",
  diesel: "Diesel",
  other: "Other",
};

const COLOR_LABELS: Record<string, string> = {
  grays: "Grays",
  blacks: "Blacks",
  browns: "Browns",
  blues: "Blues",
  greens: "Greens",
};

const FLOATING_STRUCTURE_LABELS: Record<string, string> = {
  work_float: "Work float",
  barge: "Barge",
  other: "Other structure",
};

const LAUNCH_SITE_LABELS: Record<string, string> = {
  public_boat_launch: "Public boat launch",
  private_property_applicant: "Private property owned by the applicant",
  other: "Other",
};

const MOORING_VESSEL_LABELS: Record<string, string> = {
  commercial: "Commercial",
  recreational: "Recreational",
};

const SITE_TYPE_LABELS: Record<string, string> = {
  experimental: "Experimental lease",
  standard: "Standard lease",
  lpa: "LPA license",
};

const ACTIVITY_LABELS: Record<string, string> = {
  kayaking: "Kayaking",
  swimming: "Swimming",
  other: "Other",
};

const LOCATION_LABELS: Record<string, string> = {
  within_boundaries: "Within the proposal boundaries",
  within_vicinity: "Within the vicinity of the proposed site",
};

const GOVT_KIND_LABELS: Record<string, string> = {
  conserved_land: "Government-owned conserved land",
  docking_facility: "Government-owned docking facility",
  beach: "Government-owned beach",
};

const GOVT_LEVEL_LABELS: Record<string, string> = {
  federal: "Federal",
  state: "State",
  municipal: "Municipal",
};

const COLOR_CHOICES = choicesFrom(EquipmentColor.options, COLOR_LABELS);

/* -------------------------------------------------------------------------- */
/* Composite shapes                                                            */
/* -------------------------------------------------------------------------- */

const GOVT_PROPERTY_PARTS: RecordPart[] = [
  {
    key: "kind",
    label: "Conserved land, facility, or beach",
    control: { kind: "choice", choices: choicesFrom(GovtPropertyKind.options, GOVT_KIND_LABELS) },
    required: true,
  },
  { key: "name", label: "Name", control: { kind: "text" } },
  { key: "proximityFt", label: "Distance from the site", control: { kind: "number", unit: "ft" } },
  {
    key: "ownershipLevel",
    label: "Owned by",
    control: { kind: "choice", choices: choicesFrom(["federal", "state", "municipal"], GOVT_LEVEL_LABELS) },
  },
  { key: "ownerName", label: "Government entity", control: { kind: "text" } },
];

const HATCHERY_STOCK_PARTS: RecordPart[] = [
  { key: "commonName", label: "Common name", control: { kind: "text" }, required: true },
  { key: "latinName", label: "Latin name", control: { kind: "text" } },
  { key: "sourceName", label: "Name of source", control: { kind: "text" } },
  { key: "stockingDensity", label: "Stocking density", control: { kind: "text" } },
];

const SITE_STOCK_PARTS: RecordPart[] = [
  { key: "commonName", label: "Common name", control: { kind: "text" }, required: true },
  { key: "latinName", label: "Latin name", control: { kind: "text" } },
  { key: "siteId", label: "Aquaculture site ID", control: { kind: "text" } },
  { key: "waterbody", label: "Waterbody", control: { kind: "text" } },
  { key: "originalPointOfOrigin", label: "Original point of origin", control: { kind: "text" } },
  { key: "stockingDensity", label: "Stocking density", control: { kind: "text" } },
];

const WILD_STOCK_PARTS: RecordPart[] = [
  { key: "commonName", label: "Common name", control: { kind: "text" }, required: true },
  { key: "latinName", label: "Latin name", control: { kind: "text" } },
  { key: "waterbody", label: "Waterbody collected from", control: { kind: "text" } },
  { key: "harvesterName", label: "Licensed harvester", control: { kind: "text" } },
  { key: "stockingDensity", label: "Stocking density", control: { kind: "text" } },
];

const GEAR_ITEM_PARTS: RecordPart[] = [
  {
    key: "type",
    label: "Gear or mooring type",
    control: { kind: "text" },
    hint: "Everything deployed within the boundaries: gear, longlines, moorings, buoys.",
    required: true,
  },
  { key: "dimensions", label: "Dimensions", control: { kind: "text" } },
  { key: "datesOfDeployment", label: "Dates of deployment", control: { kind: "text" } },
  { key: "maximumNumber", label: "Maximum number on site", control: { kind: "number" } },
  { key: "color", label: "Color", control: { kind: "text" } },
  { key: "speciesGrown", label: "Species grown with this gear", control: { kind: "text" } },
];

const EQUIPMENT_PARTS: RecordPart[] = [
  { key: "name", label: "Equipment name", control: { kind: "text" }, required: true },
  { key: "purpose", label: "What it's used for", control: { kind: "textarea" } },
  { key: "colors", label: "Color(s)", control: { kind: "choice_list", choices: COLOR_CHOICES } },
  { key: "hasExteriorLights", label: "Exterior lights?", control: { kind: "boolean" } },
  { key: "powerSource", label: "How it's powered", control: { kind: "text" } },
  { key: "monthsUsed", label: "Months used", control: { kind: "text" } },
  { key: "maxDaysPerYear", label: "Maximum days per year", control: { kind: "number" } },
  { key: "daysOfWeek", label: "Days of the week", control: { kind: "text" } },
  { key: "maxHoursPerDay", label: "Maximum hours per day", control: { kind: "number" } },
  { key: "noiseMitigation", label: "Noise mitigation", control: { kind: "textarea" } },
];

const VESSEL_PARTS: RecordPart[] = [
  { key: "type", label: "Type of vessel", control: { kind: "text" }, required: true },
  { key: "engineTypeAndHp", label: "Engine type and HP", control: { kind: "text" } },
  { key: "lengthFt", label: "Length", control: { kind: "number", unit: "ft" } },
  { key: "heightFt", label: "Height from waterline", control: { kind: "number", unit: "ft" } },
  { key: "daysPerYear", label: "Days per year on site", control: { kind: "number" } },
  { key: "hoursPerDay", label: "Hours per day on site", control: { kind: "number" } },
];

const OTHER_ACTIVITY_PARTS: RecordPart[] = [
  {
    key: "activity",
    label: "Activity",
    control: { kind: "choice", choices: choicesFrom(OtherWaterActivity.options, ACTIVITY_LABELS) },
    required: true,
  },
  { key: "activityNote", label: "Activity, if other", control: { kind: "text" } },
  { key: "monthsObserved", label: "Month(s) of observation", control: { kind: "text" } },
  { key: "participantCount", label: "How many persons or vessels", control: { kind: "text" } },
  {
    key: "locations",
    label: "Where",
    control: {
      kind: "choice_list",
      choices: choicesFrom(ActivityLocation.options, LOCATION_LABELS),
    },
  },
];

const EXISTING_SITE_PARTS: RecordPart[] = [
  { key: "holderName", label: "Name of holder", control: { kind: "text" }, required: true },
  {
    key: "siteType",
    label: "Type of site",
    control: { kind: "choice", choices: choicesFrom(AquacultureSiteType.options, SITE_TYPE_LABELS) },
    required: true,
  },
  { key: "siteId", label: "Site ID", control: { kind: "text" } },
  {
    key: "acreage",
    label: "Acreage",
    control: { kind: "number" },
    hint: "Leases only. Don't provide a size for LPA sites.",
  },
];

const RIPARIAN_LANDOWNER_PARTS: RecordPart[] = [
  { key: "ownerName", label: "Landowner name", control: { kind: "text" }, required: true },
  { key: "taxMapNumber", label: "Tax map number", control: { kind: "text" } },
  { key: "lotNumber", label: "Lot number", control: { kind: "text" } },
  {
    key: "mailingAddress",
    label: "Mailing address",
    control: { kind: "textarea" },
    hint: "As it appears in municipal tax records.",
  },
];

const CORNER_PARTS: RecordPart[] = [
  {
    key: "latitude",
    label: "Latitude (°N)",
    control: { kind: "number", unit: "°N" },
    required: true,
  },
  {
    key: "longitude",
    label: "Longitude (°W is negative)",
    control: { kind: "number", unit: "°" },
    required: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Shared editor fragments                                                     */
/* -------------------------------------------------------------------------- */

const SHARED_EDITORS: Record<string, Control> = {
  /* Applicant information */
  applicantName: { kind: "text" },
  contactPerson: { kind: "text" },
  applicantEmail: { kind: "text" },
  applicantTelephone: { kind: "text" },
  mailingStreet: { kind: "text" },
  mailingCity: { kind: "text" },
  mailingState: { kind: "text" },
  mailingZip: { kind: "text" },
  physicalSameAsMailing: { kind: "boolean" },
  physicalStreet: { kind: "text" },
  physicalCity: { kind: "text" },
  physicalState: { kind: "text" },
  physicalZip: { kind: "text" },
  paymentType: { kind: "choice", choices: choicesFrom(PaymentType.options, PAYMENT_TYPE_LABELS) },

  /* Proposal information */
  town: { kind: "text" },
  county: { kind: "text" },
  waterbody: { kind: "text" },
  generalDescription: { kind: "textarea" },
  totalAcreage: { kind: "number", unit: "acres" },
  leaseTermYears: { kind: "number", unit: "years" },
  cultureTypes: { kind: "choice_list", choices: choicesFrom(CultureType.options, CULTURE_TYPE_LABELS) },
  isAboveMeanLowWater: { kind: "boolean" },

  /* Interagency review */
  habitatDesignations: {
    kind: "choice_list",
    choices: choicesFrom(HabitatDesignation.options, HABITAT_LABELS),
  },
  depthAtMeanHighWaterFt: { kind: "number", unit: "ft" },
  depthAtMeanLowWaterFt: { kind: "number", unit: "ft" },
  usesSuspendedGear: { kind: "boolean" },
  gearSubmergedAtAllTides: { kind: "boolean" },
  proposesPredatorNetting: { kind: "boolean" },
  nettingMeshSize: { kind: "text" },
  nettingTwineSize: { kind: "text" },
  govtPropertiesWithin1000Ft: {
    kind: "record_list",
    itemLabel: "Property",
    parts: GOVT_PROPERTY_PARTS,
  },
  inMarkedNavigationChannel: { kind: "boolean" },
  distanceToNearestChannelFt: { kind: "number", unit: "ft" },
  nearFederalNavigationProject: { kind: "boolean" },
  federalNavigationProjectName: { kind: "text" },

  /* Source of stock and water quality */
  hatcheryStock: { kind: "record_list", itemLabel: "Species", parts: HATCHERY_STOCK_PARTS },
  siteStock: { kind: "record_list", itemLabel: "Species", parts: SITE_STOCK_PARTS },
  wildStock: { kind: "record_list", itemLabel: "Species", parts: WILD_STOCK_PARTS },
  intendsWholeOrRoeOnScallops: { kind: "boolean" },
  growingAreaDesignation: { kind: "text" },
  growingAreaClassification: {
    kind: "choice",
    choices: choicesFrom(GrowingAreaClassification.options, CLASSIFICATION_LABELS),
  },
  birdDeterrenceMeasures: { kind: "textarea" },

  /* Cultivation and on-site activity */
  cultureMethod: { kind: "choice", choices: choicesFrom(CultureMethod.options, CULTURE_METHOD_LABELS) },
  onSiteDaysOfWeek: { kind: "text" },
  workStartTime: { kind: "text" },
  workEndTime: { kind: "text" },
  tendingDescription: { kind: "textarea" },
  harvestMonths: { kind: "text" },
  harvestMethods: { kind: "textarea" },
  hasSeasonalGearChanges: { kind: "boolean" },
  seasonalGearChangesDescription: { kind: "textarea" },

  /* Motorized equipment and lighting */
  usesMotorizedEquipment: { kind: "boolean" },
  hasFixedNoiseSources: { kind: "boolean" },
  fixedNoiseDirectionPlan: { kind: "textarea" },
  equipmentHasExteriorLighting: { kind: "boolean" },
  lightingMitigationMeasures: { kind: "textarea" },
  usesGenerator: { kind: "boolean" },
  generatorPurpose: { kind: "textarea" },
  generatorMonths: { kind: "text" },
  generatorMaxDaysPerYear: { kind: "number", unit: "days" },
  generatorDaysOfWeek: { kind: "text" },
  generatorMaxHoursPerDay: { kind: "number", unit: "hours" },
  generatorNoiseMitigatingDesign: { kind: "boolean" },
  generatorNoiseMitigation: { kind: "textarea" },
  motorizedEquipment: { kind: "record_list", itemLabel: "Equipment", parts: EQUIPMENT_PARTS },

  /* Floating structures and buildings */
  floatingStructureTypes: {
    kind: "choice_list",
    choices: choicesFrom(FloatingStructureType.options, FLOATING_STRUCTURE_LABELS),
  },
  floatingStructureOtherNote: { kind: "text" },
  floatingStructureMonths: { kind: "text" },
  floatingStructurePurpose: { kind: "textarea" },
  floatingStructureLengthWidthFt: { kind: "text" },
  floatingStructureColor: { kind: "choice", choices: COLOR_CHOICES },
  floatingStructureHasLighting: { kind: "boolean" },
  floatingStructureLightMitigation: { kind: "textarea" },
  proposesBuilding: { kind: "boolean" },
  buildingPurpose: { kind: "textarea" },
  buildingMaxDaysPerYear: { kind: "number", unit: "days" },
  buildingLengthWidthFt: { kind: "text" },
  buildingHeightFt: { kind: "number", unit: "ft" },
  buildingColor: { kind: "choice", choices: COLOR_CHOICES },
  buildingVisualImpactMeasures: { kind: "textarea" },

  /* Vessels */
  vessels: { kind: "record_list", itemLabel: "Vessel", parts: VESSEL_PARTS },
  storesPetroleumOnSite: { kind: "boolean" },

  /* Other aquaculture sites */
  lpaWithinSite: { kind: "boolean" },
  lpaWithinSiteIds: { kind: "text_list", itemLabel: "LPA site ID" },
  lpaWithin1000Ft: { kind: "boolean" },
  lpaWithin1000FtIds: { kind: "text_list", itemLabel: "LPA site ID" },
  experimentalWithinSite: { kind: "boolean" },
  experimentalWithinSiteIds: { kind: "text_list", itemLabel: "Lease site ID" },
  experimentalWithin1000Ft: { kind: "boolean" },
  experimentalWithin1000FtIds: { kind: "text_list", itemLabel: "Lease site ID" },
  standardWithinSite: { kind: "boolean" },
  standardWithinSiteIds: { kind: "text_list", itemLabel: "Lease site ID" },
  standardWithin1000Ft: { kind: "boolean" },
  standardWithin1000FtIds: { kind: "text_list", itemLabel: "Lease site ID" },

  /* Operational capability */
  holdsOtherAquacultureSites: { kind: "boolean" },
  existingSites: { kind: "record_list", itemLabel: "Site", parts: EXISTING_SITE_PARTS },
  waterExperience: { kind: "textarea" },
  convictedOfMarineViolation: { kind: "boolean" },
  adjudicatedMarineViolation: { kind: "boolean" },
  annualLeaseRent: { kind: "text" },
  annualLicensingFees: { kind: "text" },
  annualBondOrEscrowCost: { kind: "text" },
  annualEquipmentCosts: { kind: "text" },
  annualMaintenanceCosts: { kind: "text" },

  /* Riparian landowner notification */
  isWithin1000FtOfShorefront: { kind: "boolean" },
  riparianMunicipality: { kind: "text" },
  riparianLandowners: {
    kind: "record_list",
    itemLabel: "Landowner",
    parts: RIPARIAN_LANDOWNER_PARTS,
  },
  municipalityHasShellfishProgram: { kind: "boolean" },

  /* Site coordinates */
  corners: { kind: "record_list", itemLabel: "Corner", parts: CORNER_PARTS },
};

/* -------------------------------------------------------------------------- */
/* The two maps                                                                */
/* -------------------------------------------------------------------------- */

export const STANDARD_DRAFT_EDITORS: Record<StandardDraftFormKey, Control> = {
  ...(SHARED_EDITORS as Record<StandardDraftFormKey, Control>),
  preApplicationMeetingDate: { kind: "text" },
  gearLocation: { kind: "choice", choices: choicesFrom(GearLocation.options, GEAR_LOCATION_LABELS) },
  gearTypesDescription: { kind: "textarea" },
};

export const STANDARD_FINAL_EDITORS: Record<StandardFinalFormKey, Control> = {
  ...(SHARED_EDITORS as Record<StandardFinalFormKey, Control>),
  scopingSessionDate: { kind: "text" },

  /* Environmental characterization */
  bottomCharacteristics: { kind: "textarea" },
  bottomObservationDate: { kind: "text" },
  currentSpeed: { kind: "text" },
  currentSpeedObservationDate: { kind: "text" },
  currentDirection: { kind: "text" },
  currentDirectionObservationDate: { kind: "text" },
  faunaDescription: { kind: "textarea" },
  faunaObservationDate: { kind: "text" },
  floraDescription: { kind: "textarea" },
  floraObservationDate: { kind: "text" },
  eelgrassWithinSite: { kind: "boolean" },
  eelgrassWithinSiteDate: { kind: "text" },
  eelgrassWithinSiteMethod: { kind: "text" },
  eelgrassWithin1000Ft: { kind: "boolean" },
  eelgrassWithin1000FtDate: { kind: "text" },
  eelgrassWithin1000FtMethod: { kind: "text" },
  iceFormationDescription: { kind: "textarea" },

  /* Final-only operations */
  gearItems: { kind: "record_list", itemLabel: "Gear or mooring", parts: GEAR_ITEM_PARTS },
  bottomPlantedSpecies: { kind: "textarea" },
  bottomPlantingAreas: { kind: "textarea" },
  seedingMonths: { kind: "text" },
  maxSeedingDays: { kind: "number", unit: "days" },

  /* Final-only equipment and structures */
  lightingGlareMeasures: { kind: "textarea" },
  generatorFuel: { kind: "choice", choices: choicesFrom(GeneratorFuel.options, GENERATOR_FUEL_LABELS) },
  generatorFuelOther: { kind: "text" },
  floatingStructureHeightFt: { kind: "number", unit: "ft" },
  floatingStructureMaterials: { kind: "text" },
  floatingStructureGlareMeasures: { kind: "textarea" },
  buildingRoofingMaterials: { kind: "text" },
  buildingSidingMaterials: { kind: "text" },

  /* Final-only vessels */
  launchSites: { kind: "choice_list", choices: choicesFrom(LaunchSite.options, LAUNCH_SITE_LABELS) },
  launchSiteOtherNote: { kind: "text" },

  /* Existing uses */
  commercialNavObservationMonths: { kind: "text" },
  commercialNavObservationYears: { kind: "text" },
  commercialNavVesselTypes: { kind: "textarea" },
  commercialNavVesselLength: { kind: "text" },
  commercialNavVesselCount: { kind: "text" },
  commercialNavTransitsSite: { kind: "boolean" },
  commercialNavTransitCount: { kind: "text" },
  commercialNavTrafficDirection: { kind: "text" },
  recreationalNavObservationMonths: { kind: "text" },
  recreationalNavObservationYears: { kind: "text" },
  recreationalNavVesselTypes: { kind: "textarea" },
  recreationalNavVesselSize: { kind: "text" },
  recreationalNavVesselCount: { kind: "text" },
  recreationalNavTransitsSite: { kind: "boolean" },
  recreationalNavTransitCount: { kind: "text" },
  recreationalNavTrafficDirection: { kind: "text" },
  mooringsObservationMonths: { kind: "text" },
  mooringsObservationYears: { kind: "text" },
  hasMooringsInVicinity: { kind: "boolean" },
  mooringsWithin1000FtCount: { kind: "number" },
  mooringVesselTypes: {
    kind: "choice_list",
    choices: choicesFrom(MooringVesselType.options, MOORING_VESSEL_LABELS),
  },
  mooringClosestDistanceFt: { kind: "number", unit: "ft" },
  mooringVesselLengthFt: { kind: "number", unit: "ft" },
  commercialFishingObservationMonths: { kind: "text" },
  commercialFishingObservationYears: { kind: "text" },
  commercialFishingWithinSite: { kind: "boolean" },
  commercialFishingWithinSiteTypes: { kind: "textarea" },
  commercialFishingWithinSiteMonths: { kind: "text" },
  commercialFishingWithinSitePeople: { kind: "text" },
  commercialFishingInVicinity: { kind: "boolean" },
  commercialFishingVicinityTypes: { kind: "textarea" },
  commercialFishingVicinityMonths: { kind: "text" },
  commercialFishingVicinityPeople: { kind: "text" },
  recreationalFishingObservationMonths: { kind: "text" },
  recreationalFishingObservationYears: { kind: "text" },
  recreationalFishingWithinSite: { kind: "boolean" },
  recreationalFishingWithinSiteTypes: { kind: "textarea" },
  recreationalFishingWithinSiteMonths: { kind: "text" },
  recreationalFishingWithinSitePeople: { kind: "text" },
  recreationalFishingInVicinity: { kind: "boolean" },
  recreationalFishingVicinityTypes: { kind: "textarea" },
  recreationalFishingVicinityMonths: { kind: "text" },
  recreationalFishingVicinityPeople: { kind: "text" },
  riparianObservationMonths: { kind: "text" },
  riparianObservationYears: { kind: "text" },
  shorelineDescription: { kind: "textarea" },
  observedRiparianVessels: { kind: "boolean" },
  riparianVesselTypes: { kind: "text" },
  riparianVesselLengths: { kind: "text" },
  uplandsDescription: { kind: "textarea" },
  hasDocksInArea: { kind: "boolean" },
  docksWithin1000FtCount: { kind: "number" },
  observedVesselsAtDocks: { kind: "boolean" },
  dockVesselLengths: { kind: "text" },
  closestDockDistanceFt: { kind: "number", unit: "ft" },
  otherWaterActivities: { kind: "record_list", itemLabel: "Activity", parts: OTHER_ACTIVITY_PARTS },
};

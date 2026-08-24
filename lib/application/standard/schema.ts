/**
 * The Standard (non-discharge) Aquaculture Lease applications, as data.
 *
 * The Standard lease is the one license whose process files *two* applications:
 * a draft (rev. 12/30/2024, $500) submitted after the pre-application meeting
 * to inform the public scoping session, and a final (rev. 12/30/2024, $1,000)
 * submitted after the scoping session and heard at a public hearing. They are
 * siblings by design — the draft asks a subset of the final's questions in
 * lighter form — so this module defines both, built from shared shape objects.
 *
 * **Field keys are deliberately identical wherever the printed question is the
 * same.** That is what makes advancing from the draft to the final application
 * a mechanical copy of the intersection (see lib/application/advance.ts):
 * nothing is re-asked that the draft already answered, and nothing is carried
 * that the final does not ask.
 *
 * Both forms are modeled field-for-field against the printed PDFs
 * (data/knowledge_base/Standard_Lease_Draft_Application.pdf and
 * Standard_Lease_Final_Application.pdf), with the instructions consulted for
 * limits: at most 100 acres and a 20-year term may be requested.
 *
 * Differences from the Experimental form worth knowing about, because the
 * wording is otherwise close kin: there is no research program (a standard
 * lease is the long-term license, not a trial), no discharge question (these
 * are the *non-discharge* forms), the within-1,000-feet question adds
 * government-owned **conserved lands** to docks and beaches, the color
 * checklists have no "Other" option, and the final form says "bottom planting"
 * where the experimental says "free planting".
 */
import { z } from "zod";

import { RequirementStatus } from "../definition";

export { RequirementStatus };

/* -------------------------------------------------------------------------- */
/* Enumerations taken from the forms' checkbox lists                           */
/* -------------------------------------------------------------------------- */

export const PaymentType = z.enum(["check", "credit_card"]);

const PAYMENT_TYPE_VALUES =
  "'check': a check is enclosed with the mailed application. " +
  "'credit_card': DMR will contact the applicant for payment details; the " +
  "application may then be mailed or emailed.";

export const CultureType = z.enum(["suspended", "bottom"]);

const CULTURE_TYPE_VALUES =
  "'suspended': gear in the water column and/or on the bottom. " +
  "'bottom': bottom culture with no gear. Both may apply.";

export const HabitatDesignation = z.enum([
  "essential_habitat",
  "shorebird_area",
  "tidal_waterfowl_wading_bird",
]);

const HABITAT_VALUES =
  "'essential_habitat': MDIFW Essential Habitat, including Roseate Tern and " +
  "Piping Plover/Least Tern habitat. 'shorebird_area': a designated shorebird " +
  "area. 'tidal_waterfowl_wading_bird': Tidal Waterfowl and Wading Bird Habitat.";

export const GrowingAreaClassification = z.enum([
  "approved",
  "conditionally_approved",
  "restricted",
  "conditionally_restricted",
  "prohibited",
]);

const CLASSIFICATION_VALUES =
  "DMR's shellfish growing-area classification for the water: 'approved', " +
  "'conditionally_approved', 'restricted', 'conditionally_restricted', or " +
  "'prohibited', exactly as the applicant reads it off DMR's classification map.";

export const CultureMethod = z.enum(["gear_only", "bottom_planting_only", "combination"]);

const CULTURE_METHOD_VALUES =
  "'gear_only': all culture happens in or on gear. " +
  "'bottom_planting_only': planting on the bottom with no gear proposed. " +
  "'combination': both gear and bottom planting.";

/** Draft only: where proposed gear sits in the water. */
export const GearLocation = z.enum(["floating", "suspended_below", "combination"]);

const GEAR_LOCATION_VALUES =
  "'floating': gear floating on the surface of the water. " +
  "'suspended_below': gear suspended below the surface. " +
  "'combination': both floating and suspended gear.";

export const GeneratorFuel = z.enum(["gasoline", "diesel", "other"]);

/** The standard forms print five color families and no "Other" line. */
export const EquipmentColor = z.enum(["grays", "blacks", "browns", "blues", "greens"]);

const EQUIPMENT_COLOR_VALUES =
  "The form's color families: 'grays', 'blacks', 'browns', 'blues', or " +
  "'greens'. There is no other option on this form; pick the closest family.";

export const FloatingStructureType = z.enum(["work_float", "barge", "other"]);

const FLOATING_STRUCTURE_VALUES =
  "'work_float': a float worked from. 'barge': a barge. 'other': another " +
  "floating structure, named in the note field. An empty list means no floating " +
  "structure is proposed.";

export const LaunchSite = z.enum(["public_boat_launch", "private_property_applicant", "other"]);

const LAUNCH_SITE_VALUES =
  "'public_boat_launch': a public launch. 'private_property_applicant': private " +
  "property the applicant owns. 'other': somewhere else, named in the note field.";

export const MooringVesselType = z.enum(["commercial", "recreational"]);

export const AquacultureSiteType = z.enum(["experimental", "standard", "lpa"]);

const SITE_TYPE_VALUES =
  "'experimental': an experimental lease. 'standard': a standard lease. " +
  "'lpa': a Limited Purpose Aquaculture license site.";

export const OtherWaterActivity = z.enum(["kayaking", "swimming", "other"]);

export const ActivityLocation = z.enum(["within_boundaries", "within_vicinity"]);

const ACTIVITY_LOCATION_VALUES =
  "'within_boundaries': observed inside the proposed lease boundaries. " +
  "'within_vicinity': observed in the vicinity of the proposed site.";

/** The standard forms add conserved lands to the government-property question. */
export const GovtPropertyKind = z.enum(["conserved_land", "docking_facility", "beach"]);

/* -------------------------------------------------------------------------- */
/* Repeating sub-structures                                                    */
/* -------------------------------------------------------------------------- */

export const GovtPropertySchema = z.object({
  kind: GovtPropertyKind.describe(
    "'conserved_land': government-owned conserved land. 'docking_facility': a " +
      "dock owned by federal, state or municipal government. 'beach': a " +
      "government-owned beach."
  ),
  name: z.string().nullable().describe("Name of the conserved land, docking facility, or beach."),
  proximityFt: z
    .number()
    .nullable()
    .describe("Distance from the property to the proposed lease site, in feet."),
  ownershipLevel: z
    .enum(["federal", "state", "municipal"])
    .nullable()
    .describe("Which level of government owns the property."),
  ownerName: z.string().nullable().describe("Name of the government entity that owns it."),
});

/** One row of the hatchery / non-shellfish stock list table. */
export const HatcheryStockSchema = z.object({
  commonName: z.string().describe("Common name of the species, e.g. 'American oyster'."),
  latinName: z.string().nullable().describe("Latin name, e.g. 'Crassostrea virginica'."),
  sourceName: z
    .string()
    .nullable()
    .describe("Name of the approved hatchery or non-shellfish-stock-list entity supplying it."),
  stockingDensity: z.string().nullable().describe("Stocking density as the applicant states it."),
});

/** One row of the "source of stock: other aquaculture site(s)" table. */
export const SiteStockSchema = z.object({
  commonName: z.string(),
  latinName: z.string().nullable(),
  siteId: z.string().nullable().describe("The source aquaculture site's ID."),
  waterbody: z.string().nullable().describe("Waterbody the source site sits in."),
  originalPointOfOrigin: z
    .string()
    .nullable()
    .describe("Where the stock originally came from before the source site."),
  stockingDensity: z.string().nullable(),
});

/** One row of the wild stock table. */
export const WildStockSchema = z.object({
  commonName: z.string(),
  latinName: z.string().nullable(),
  waterbody: z.string().nullable().describe("Waterbody the organisms are collected from."),
  harvesterName: z.string().nullable().describe("Name of the licensed harvester."),
  stockingDensity: z.string().nullable(),
});

/** Final only: one row of the gear and moorings table. */
export const GearItemSchema = z.object({
  type: z.string().describe("Gear or mooring type, e.g. 'oyster cage', 'granite mooring'."),
  dimensions: z.string().nullable().describe("Dimensions of a single unit."),
  datesOfDeployment: z.string().nullable().describe("Dates the item will be deployed."),
  maximumNumber: z
    .number()
    .nullable()
    .describe("Maximum number deployed on site at once."),
  color: z.string().nullable(),
  speciesGrown: z
    .string()
    .nullable()
    .describe("Species that will be grown using this gear type."),
});

/** One piece of motorized equipment (excluding vessels) and its footprint. */
export const MotorizedEquipmentSchema = z.object({
  name: z.string().describe("What the piece of equipment is, e.g. 'tumbler', 'washer'."),
  purpose: z.string().nullable().describe("What it is used for."),
  colors: z
    .array(EquipmentColor)
    .nullable()
    .describe(`Color families of the equipment. ${EQUIPMENT_COLOR_VALUES}`),
  hasExteriorLights: z.boolean().nullable(),
  powerSource: z.string().nullable().describe("How the equipment is powered."),
  monthsUsed: z
    .string()
    .nullable()
    .describe("Months it would be used; 'year-round' if all year."),
  maxDaysPerYear: z.number().nullable().describe("Maximum days per year it would be used."),
  daysOfWeek: z.string().nullable().describe("Days of the week it would be used."),
  maxHoursPerDay: z.number().nullable().describe("Maximum hours per day it would be used."),
  noiseMitigation: z
    .string()
    .nullable()
    .describe("Measures taken to mitigate noise from this piece of equipment."),
});

/** One vessel that may service the site. */
export const VesselSchema = z.object({
  type: z.string().describe("Type of vessel, e.g. 'lobster boat', 'skiff'."),
  engineTypeAndHp: z.string().nullable().describe("Engine type and horsepower."),
  lengthFt: z.number().nullable().describe("Vessel length in feet."),
  heightFt: z
    .number()
    .nullable()
    .describe("Height in feet as measured from the waterline."),
  daysPerYear: z
    .number()
    .nullable()
    .describe("Days per year the vessel would service the site."),
  hoursPerDay: z.number().nullable().describe("Hours per day the vessel would be on site."),
});

/** Final only: one row of the "other water related uses" table. */
export const OtherWaterUseSchema = z.object({
  activity: OtherWaterActivity.describe(
    "'kayaking', 'swimming', or 'other' with the activity named in the note field."
  ),
  activityNote: z.string().nullable().describe("Names the activity when it is 'other'."),
  monthsObserved: z.string().nullable().describe("Month(s) the activity was observed."),
  participantCount: z
    .string()
    .nullable()
    .describe("How many persons or vessels were engaged in the activity."),
  locations: z
    .array(ActivityLocation)
    .nullable()
    .describe(`Where it was observed. ${ACTIVITY_LOCATION_VALUES}`),
});

/** One aquaculture site the applicant already holds. */
export const ExistingSiteSchema = z.object({
  holderName: z.string().describe("Name of the holder."),
  siteType: AquacultureSiteType.describe(`Type of site. ${SITE_TYPE_VALUES}`),
  siteId: z.string().nullable(),
  acreage: z
    .number()
    .nullable()
    .describe("Acreage, for leases only. LPA sites are not given a size."),
});

/** One parcel on the riparian landowner list. */
export const RiparianLandownerSchema = z.object({
  taxMapNumber: z.string().nullable(),
  lotNumber: z.string().nullable(),
  ownerName: z.string(),
  mailingAddress: z.string().nullable().describe("Mailing address from municipal tax records."),
});

/** One corner of the site boundary, decimal degrees, WGS-84, NW first, clockwise. */
export const CornerSchema = z.object({
  latitude: z.number().describe("Decimal degrees north, e.g. 43.123456."),
  longitude: z.number().describe("Decimal degrees, negative for west, e.g. -69.123456."),
});

/* -------------------------------------------------------------------------- */
/* Shared shapes                                                               */
/*                                                                            */
/* Plain objects of zod fields, spread into both form schemas. A question     */
/* that appears on both printed forms is defined once here, under one key,    */
/* which is the invariant the draft-to-final carry-over rests on.             */
/* -------------------------------------------------------------------------- */

const APPLICANT_SHAPE = {
  applicantName: z
    .string()
    .nullable()
    .describe("Legal name of the applicant or applicants, exactly as it should appear."),
  contactPerson: z
    .string()
    .nullable()
    .describe("The contact person, who may differ from the applicant, e.g. for a company."),
  applicantEmail: z
    .string()
    .nullable()
    .describe("Contact email. Email is DMR's method of contact for this application."),
  applicantTelephone: z.string().nullable(),
  mailingStreet: z.string().nullable().describe("Mailing street address, without city/state/zip."),
  mailingCity: z.string().nullable(),
  mailingState: z.string().nullable(),
  mailingZip: z.string().nullable(),
  physicalSameAsMailing: z
    .boolean()
    .nullable()
    .describe("Whether the physical address is the same as the mailing address."),
  physicalStreet: z.string().nullable(),
  physicalCity: z.string().nullable(),
  physicalState: z.string().nullable(),
  physicalZip: z.string().nullable(),
};

const PROPOSAL_SHAPE = {
  town: z.string().nullable().describe("Municipality the proposed lease site is in."),
  county: z.string().nullable(),
  waterbody: z.string().nullable(),
  generalDescription: z
    .string()
    .nullable()
    .describe("General description of where the site sits, e.g. 'south of Hog Island'."),
  totalAcreage: z
    .number()
    .nullable()
    .describe("Total acreage requested, in acres. The regulatory maximum is 100 acres."),
  leaseTermYears: z
    .number()
    .nullable()
    .describe("Lease term requested, in years. The regulatory maximum is 20 years."),
  cultureTypes: z
    .array(CultureType)
    .nullable()
    .describe(`Every culture type that applies. ${CULTURE_TYPE_VALUES}`),
  isAboveMeanLowWater: z
    .boolean()
    .nullable()
    .describe(
      "Whether any portion of the proposed site is above mean low water, i.e. intertidal."
    ),
};

const INTERAGENCY_SHAPE = {
  habitatDesignations: z
    .array(HabitatDesignation)
    .nullable()
    .describe(
      "Habitat designations the site falls within, empty list if none. " + HABITAT_VALUES
    ),
  depthAtMeanHighWaterFt: z.number().nullable().describe("Water depth at mean high water, feet."),
  depthAtMeanLowWaterFt: z.number().nullable().describe("Water depth at mean low water, feet."),
  usesSuspendedGear: z.boolean().nullable().describe("Whether any suspended gear is proposed."),
  gearSubmergedAtAllTides: z
    .boolean()
    .nullable()
    .describe("Whether the suspended gear stays below the surface at all tidal stages."),
  proposesPredatorNetting: z.boolean().nullable(),
  nettingMeshSize: z.string().nullable().describe("Mesh size of the predator netting."),
  nettingTwineSize: z.string().nullable().describe("Twine size of the predator netting."),
  govtPropertiesWithin1000Ft: z
    .array(GovtPropertySchema)
    .nullable()
    .describe(
      "Government-owned conserved lands, docking facilities, or beaches within " +
        "1,000 feet, with their details. Empty list when there are none."
    ),
  inMarkedNavigationChannel: z
    .boolean()
    .nullable()
    .describe("Whether any portion of the proposal is within a marked navigational channel."),
  distanceToNearestChannelFt: z
    .number()
    .nullable()
    .describe("Distance in feet to the nearest marked channel, when the site is not in one."),
  nearFederalNavigationProject: z
    .boolean()
    .nullable()
    .describe("Whether the site is within 1,000 feet of a federal navigation project or anchorage."),
  federalNavigationProjectName: z
    .string()
    .nullable()
    .describe("Which project or anchorage, when the answer above is yes."),
};

/** Final only. The draft asks nothing about environmental characterization. */
const ENVIRONMENT_SHAPE = {
  bottomCharacteristics: z
    .string()
    .nullable()
    .describe("Observed bottom characteristics of the proposed site."),
  bottomObservationDate: z
    .string()
    .nullable()
    .describe(
      "Date of that observation. Observations must be made between April 1 and " +
        "November 15; record the date the applicant gives."
    ),
  currentSpeed: z.string().nullable().describe("Observed speed of the current."),
  currentSpeedObservationDate: z.string().nullable(),
  currentDirection: z.string().nullable().describe("Observed direction of the current."),
  currentDirectionObservationDate: z.string().nullable(),
  faunaDescription: z.string().nullable().describe("Animals observed in the area."),
  faunaObservationDate: z.string().nullable(),
  floraDescription: z.string().nullable().describe("Plants observed in the area."),
  floraObservationDate: z.string().nullable(),
  eelgrassWithinSite: z
    .boolean()
    .nullable()
    .describe("Whether eelgrass was observed within the boundaries of the proposed site."),
  eelgrassWithinSiteDate: z.string().nullable().describe("Date of the eelgrass observation."),
  eelgrassWithinSiteMethod: z
    .string()
    .nullable()
    .describe("Method of the observation, e.g. viewing scope, dive, drone."),
  eelgrassWithin1000Ft: z
    .boolean()
    .nullable()
    .describe("Whether eelgrass was observed within 1,000 feet of the proposed site."),
  eelgrassWithin1000FtDate: z.string().nullable(),
  eelgrassWithin1000FtMethod: z.string().nullable(),
  iceFormationDescription: z
    .string()
    .nullable()
    .describe(
      "Ice formation during winter within the proposed boundaries, with data: " +
        "water temperature or ice-out dates over ten years, or at least five " +
        "years of observations from the harbormaster, shellfish warden, harbor " +
        "committee, Marine Patrol, or fishing community. A bare 'no ice observed' " +
        "is not accepted by DMR, but record whatever the applicant says."
    ),
};

const STOCK_WATER_SHAPE = {
  hatcheryStock: z
    .array(HatcheryStockSchema)
    .nullable()
    .describe(
      "Species sourced from an approved shellfish hatchery or an entity on " +
        "DMR's non-shellfish stock list. Record species as the applicant names " +
        "them; a row with only a common name is a correct partial record. Empty " +
        "list when nothing comes from a hatchery."
    ),
  siteStock: z
    .array(SiteStockSchema)
    .nullable()
    .describe(
      "Species sourced from other aquaculture sites in coastal waters. Empty " +
        "list when nothing does."
    ),
  wildStock: z
    .array(WildStockSchema)
    .nullable()
    .describe(
      "Species collected from Maine's coastal waters for deployment on the " +
        "site. Empty list when nothing is wild-collected."
    ),
  intendsWholeOrRoeOnScallops: z
    .boolean()
    .nullable()
    .describe("Whether the applicant intends to possess whole or roe-on scallops."),
  growingAreaDesignation: z
    .string()
    .nullable()
    .describe("DMR growing area designation, e.g. 'WA' or 'WJ'."),
  growingAreaClassification: GrowingAreaClassification.nullable().describe(CLASSIFICATION_VALUES),
  birdDeterrenceMeasures: z
    .string()
    .nullable()
    .describe(
      "Mitigation or deterrent measures minimizing pollution from birds at the " +
        "site, required by the NSSP Model Ordinance for suspended shellfish culture."
    ),
};

const OPERATIONS_SHARED_SHAPE = {
  cultureMethod: CultureMethod.nullable().describe(
    `How marine organisms will be cultured. ${CULTURE_METHOD_VALUES}`
  ),
  onSiteDaysOfWeek: z
    .string()
    .nullable()
    .describe("Days of the week the applicant anticipates being on site at maximum capacity."),
  workStartTime: z
    .string()
    .nullable()
    .describe("Earliest time of day work would start on site, at maximum capacity."),
  workEndTime: z.string().nullable().describe("Latest time of day work would end on site."),
  tendingDescription: z
    .string()
    .nullable()
    .describe("Tending and maintenance activities, described."),
  harvestMonths: z.string().nullable().describe("Months harvesting will occur."),
  harvestMethods: z
    .string()
    .nullable()
    .describe("How each species will be harvested, with drag dimensions if a drag is used."),
  hasSeasonalGearChanges: z
    .boolean()
    .nullable()
    .describe("Whether there are seasonal changes to gear deployment."),
  seasonalGearChangesDescription: z.string().nullable(),
};

const EQUIPMENT_SHARED_SHAPE = {
  usesMotorizedEquipment: z
    .boolean()
    .nullable()
    .describe("Whether motorized equipment is proposed on the lease."),
  hasFixedNoiseSources: z.boolean().nullable().describe("Whether any noise sources are fixed."),
  fixedNoiseDirectionPlan: z
    .string()
    .nullable()
    .describe(
      "The plan to direct noise away from residences and areas of routine use on adjacent land."
    ),
  equipmentHasExteriorLighting: z
    .boolean()
    .nullable()
    .describe("Whether any of the equipment carries exterior lighting."),
  lightingMitigationMeasures: z
    .string()
    .nullable()
    .describe("Measures taken to mitigate light impacts from equipment."),
  usesGenerator: z.boolean().nullable(),
  generatorPurpose: z.string().nullable().describe("What the generator is used for."),
  generatorMonths: z
    .string()
    .nullable()
    .describe("Months the generator would be used; 'year-round' if all year."),
  generatorMaxDaysPerYear: z.number().nullable(),
  generatorDaysOfWeek: z.string().nullable(),
  generatorMaxHoursPerDay: z.number().nullable(),
  generatorNoiseMitigatingDesign: z
    .boolean()
    .nullable()
    .describe("Whether the generator is designed to mitigate noise."),
  generatorNoiseMitigation: z
    .string()
    .nullable()
    .describe("Measures taken to mitigate noise from the generator."),
  motorizedEquipment: z
    .array(MotorizedEquipmentSchema)
    .nullable()
    .describe(
      "Each piece of motorized equipment excluding vessels, with its details. " +
        "A row with only a name is a correct partial record."
    ),
};

const STRUCTURES_SHARED_SHAPE = {
  floatingStructureTypes: z
    .array(FloatingStructureType)
    .nullable()
    .describe(
      `The floating structures proposed, empty list for none. ${FLOATING_STRUCTURE_VALUES}`
    ),
  floatingStructureOtherNote: z
    .string()
    .nullable()
    .describe("Names the structure when 'other' is among the types."),
  floatingStructureMonths: z
    .string()
    .nullable()
    .describe("Months the structure will be within the site boundaries."),
  floatingStructurePurpose: z.string().nullable(),
  floatingStructureLengthWidthFt: z
    .string()
    .nullable()
    .describe("Length and width in feet, e.g. '20 x 12'."),
  floatingStructureColor: EquipmentColor.nullable().describe(EQUIPMENT_COLOR_VALUES),
  floatingStructureHasLighting: z.boolean().nullable(),
  floatingStructureLightMitigation: z
    .string()
    .nullable()
    .describe("Measures mitigating light impacts from the structure."),
  proposesBuilding: z
    .boolean()
    .nullable()
    .describe("Whether a shed, building, or similar structure is proposed."),
  buildingPurpose: z.string().nullable(),
  buildingMaxDaysPerYear: z
    .number()
    .nullable()
    .describe("Maximum days per year it would be within the site; year-round counts as 365."),
  buildingLengthWidthFt: z.string().nullable().describe("Length and width in feet."),
  buildingHeightFt: z
    .number()
    .nullable()
    .describe("Height in feet as measured from the waterline."),
  buildingColor: EquipmentColor.nullable().describe(EQUIPMENT_COLOR_VALUES),
  buildingVisualImpactMeasures: z
    .string()
    .nullable()
    .describe("Measures minimizing visual impacts as viewed from the water."),
};

const VESSELS_SHARED_SHAPE = {
  vessels: z
    .array(VesselSchema)
    .nullable()
    .describe("The vessels that may service the proposed site."),
  storesPetroleumOnSite: z
    .boolean()
    .nullable()
    .describe(
      "Whether petroleum products are stored on the proposed site. If yes, a " +
        "spill prevention and control plan must be attached."
    ),
};

/** Final only: the existing-uses section, the applicant's own observations. */
const EXISTING_USES_SHAPE = {
  commercialNavObservationMonths: z
    .string()
    .nullable()
    .describe("Month(s) the commercial-navigation observations were completed."),
  commercialNavObservationYears: z.string().nullable().describe("Year(s) of those observations."),
  commercialNavVesselTypes: z
    .string()
    .nullable()
    .describe("Types of commercial vessels observed navigating in the area."),
  commercialNavVesselLength: z
    .string()
    .nullable()
    .describe("Approximate length in feet of the commercial vessels observed."),
  commercialNavVesselCount: z
    .string()
    .nullable()
    .describe("How many commercial vessels were observed navigating in the area."),
  commercialNavTransitsSite: z
    .boolean()
    .nullable()
    .describe("Whether any commercial vessels transited through the proposed boundaries."),
  commercialNavTransitCount: z
    .string()
    .nullable()
    .describe("How many transited through, when the answer above is yes."),
  commercialNavTrafficDirection: z
    .string()
    .nullable()
    .describe("Typical direction of commercial vessel traffic."),

  recreationalNavObservationMonths: z.string().nullable(),
  recreationalNavObservationYears: z.string().nullable(),
  recreationalNavVesselTypes: z
    .string()
    .nullable()
    .describe("Types of recreational vessels observed navigating in the area."),
  recreationalNavVesselSize: z
    .string()
    .nullable()
    .describe("Approximate size of the recreational vessels observed."),
  recreationalNavVesselCount: z.string().nullable(),
  recreationalNavTransitsSite: z
    .boolean()
    .nullable()
    .describe("Whether any recreational vessels transited through the proposed boundaries."),
  recreationalNavTransitCount: z.string().nullable(),
  recreationalNavTrafficDirection: z.string().nullable(),

  mooringsObservationMonths: z.string().nullable(),
  mooringsObservationYears: z.string().nullable(),
  hasMooringsInVicinity: z
    .boolean()
    .nullable()
    .describe("Whether there are any moorings within the vicinity of the proposed lease site."),
  mooringsWithin1000FtCount: z
    .number()
    .nullable()
    .describe("How many moorings are within 1,000 feet of the proposed site."),
  mooringVesselTypes: z
    .array(MooringVesselType)
    .nullable()
    .describe("What type of vessels use the moorings: 'commercial', 'recreational', or both."),
  mooringClosestDistanceFt: z
    .number()
    .nullable()
    .describe("Distance in feet from the proposed site to the closest observed mooring."),
  mooringVesselLengthFt: z
    .number()
    .nullable()
    .describe("Length in feet of the vessel that uses that closest mooring."),

  commercialFishingObservationMonths: z.string().nullable(),
  commercialFishingObservationYears: z.string().nullable(),
  commercialFishingWithinSite: z
    .boolean()
    .nullable()
    .describe("Whether any commercial fishing occurs within the proposed boundaries."),
  commercialFishingWithinSiteTypes: z
    .string()
    .nullable()
    .describe("Types of commercial fishing occurring within the boundaries."),
  commercialFishingWithinSiteMonths: z.string().nullable(),
  commercialFishingWithinSitePeople: z
    .string()
    .nullable()
    .describe("How many people commercially fish within the proposed lease area."),
  commercialFishingInVicinity: z
    .boolean()
    .nullable()
    .describe("Whether any commercial fishing occurs within the vicinity of the site."),
  commercialFishingVicinityTypes: z.string().nullable(),
  commercialFishingVicinityMonths: z.string().nullable(),
  commercialFishingVicinityPeople: z.string().nullable(),

  recreationalFishingObservationMonths: z.string().nullable(),
  recreationalFishingObservationYears: z.string().nullable(),
  recreationalFishingWithinSite: z.boolean().nullable(),
  recreationalFishingWithinSiteTypes: z.string().nullable(),
  recreationalFishingWithinSiteMonths: z.string().nullable(),
  recreationalFishingWithinSitePeople: z.string().nullable(),
  recreationalFishingInVicinity: z.boolean().nullable(),
  recreationalFishingVicinityTypes: z.string().nullable(),
  recreationalFishingVicinityMonths: z.string().nullable(),
  recreationalFishingVicinityPeople: z.string().nullable(),

  riparianObservationMonths: z.string().nullable(),
  riparianObservationYears: z.string().nullable(),
  shorelineDescription: z
    .string()
    .nullable()
    .describe("The shoreline in the vicinity of the lease proposal, described."),
  observedRiparianVessels: z
    .boolean()
    .nullable()
    .describe("Whether any riparian-owned vessels were observed accessing the shoreline."),
  riparianVesselTypes: z.string().nullable(),
  riparianVesselLengths: z.string().nullable().describe("Length in feet of those vessels."),
  uplandsDescription: z
    .string()
    .nullable()
    .describe("The surrounding uplands in the vicinity, described."),

  hasDocksInArea: z.boolean().nullable(),
  docksWithin1000FtCount: z.number().nullable(),
  observedVesselsAtDocks: z
    .boolean()
    .nullable()
    .describe("Whether vessels were observed accessing or secured to the docks."),
  dockVesselLengths: z.string().nullable(),
  closestDockDistanceFt: z
    .number()
    .nullable()
    .describe("Distance in feet from the proposed site to the closest observed dock."),

  otherWaterActivities: z
    .array(OtherWaterUseSchema)
    .nullable()
    .describe(
      "Kayaking, swimming, or other activities occurring within the vicinity, " +
        "with months, counts and where. Empty list when none occur."
    ),
};

const OTHER_SITES_SHAPE = {
  lpaWithinSite: z
    .boolean()
    .nullable()
    .describe("Whether any LPA licenses are within the boundaries of the proposed site."),
  lpaWithinSiteIds: z.array(z.string()).nullable().describe("Their LPA site IDs."),
  lpaWithin1000Ft: z.boolean().nullable(),
  lpaWithin1000FtIds: z.array(z.string()).nullable(),
  experimentalWithinSite: z
    .boolean()
    .nullable()
    .describe("Whether any portion of an experimental lease is within the boundaries."),
  experimentalWithinSiteIds: z.array(z.string()).nullable(),
  experimentalWithin1000Ft: z.boolean().nullable(),
  experimentalWithin1000FtIds: z.array(z.string()).nullable(),
  standardWithinSite: z
    .boolean()
    .nullable()
    .describe("Whether any portion of a standard lease is within the boundaries."),
  standardWithinSiteIds: z.array(z.string()).nullable(),
  standardWithin1000Ft: z.boolean().nullable(),
  standardWithin1000FtIds: z.array(z.string()).nullable(),
};

const CAPABILITY_SHAPE = {
  holdsOtherAquacultureSites: z
    .boolean()
    .nullable()
    .describe("Whether the applicant, or any co-applicant, holds existing aquaculture sites."),
  existingSites: z.array(ExistingSiteSchema).nullable(),
  waterExperience: z
    .string()
    .nullable()
    .describe("The applicant's skills and experience working on the water."),
  convictedOfMarineViolation: z
    .boolean()
    .nullable()
    .describe("Whether the applicant has been convicted of violating state or federal marine resource laws."),
  adjudicatedMarineViolation: z
    .boolean()
    .nullable()
    .describe("Whether they have been adjudicated responsible for violating such laws."),
  annualLeaseRent: z
    .string()
    .nullable()
    .describe("Estimated annual lease rent. Rent is $100 per acre of the requested site."),
  annualLicensingFees: z
    .string()
    .nullable()
    .describe("Estimated annual DMR licensing fees, e.g. the aquaculture harvest license."),
  annualBondOrEscrowCost: z
    .string()
    .nullable()
    .describe(
      "Estimated annual bond cost, or the full escrow amount. No bond for " +
        "bottom-only culture; $1,500 for gear on 400 sq ft or less; $5,000 for " +
        "gear on more."
    ),
  annualEquipmentCosts: z.string().nullable().describe("Estimated annual equipment costs."),
  annualMaintenanceCosts: z.string().nullable().describe("Estimated annual maintenance costs."),
};

const RIPARIAN_SHAPE = {
  isWithin1000FtOfShorefront: z
    .boolean()
    .nullable()
    .describe(
      "Whether the proposal is within 1,000 feet of shorefront land, which " +
        "extends to mean low water or 1,650 feet from shore, whichever is less, " +
        "per NOAA charts."
    ),
  riparianMunicipality: z
    .string()
    .nullable()
    .describe("The municipality whose tax records the riparian list is drawn from."),
  riparianLandowners: z.array(RiparianLandownerSchema).nullable(),
  municipalityHasShellfishProgram: z
    .boolean()
    .nullable()
    .describe(
      "Whether the municipality has a shellfish conservation program under 12 " +
        "M.R.S.A. §6671. Only relevant for sites above mean low water."
    ),
};

const COORDINATES_SHAPE = {
  corners: z
    .array(CornerSchema)
    .nullable()
    .describe(
      "The site's corner coordinates in decimal degrees, WGS-84, starting at " +
        "the NW corner and proceeding clockwise. Up to fifteen corners."
    ),
};

const PAYMENT_SHAPE = {
  paymentType: PaymentType.nullable(),
};

/* -------------------------------------------------------------------------- */
/* The two forms                                                               */
/* -------------------------------------------------------------------------- */

export const StandardDraftFormSchema = z.object({
  ...APPLICANT_SHAPE,
  paymentType: PAYMENT_SHAPE.paymentType.describe(
    `How the $500 draft-application fee will be paid. ${PAYMENT_TYPE_VALUES}`
  ),
  preApplicationMeetingDate: z
    .string()
    .nullable()
    .describe(
      "Date the pre-application meeting with DMR was held, as YYYY-MM-DD if the " +
        "applicant gives a full date, otherwise their wording. The draft " +
        "application is submitted after that meeting."
    ),
  ...PROPOSAL_SHAPE,
  ...INTERAGENCY_SHAPE,
  ...STOCK_WATER_SHAPE,
  // The draft asks about gear in preliminary terms: where it sits and what
  // kinds, not the itemized table the final application requires.
  gearLocation: GearLocation.nullable().describe(
    `Where proposed gear will be located in the water. ${GEAR_LOCATION_VALUES}`
  ),
  gearTypesDescription: z
    .string()
    .nullable()
    .describe("The gear types used to culture the proposed species, described."),
  ...OPERATIONS_SHARED_SHAPE,
  ...EQUIPMENT_SHARED_SHAPE,
  ...STRUCTURES_SHARED_SHAPE,
  ...VESSELS_SHARED_SHAPE,
  ...OTHER_SITES_SHAPE,
  ...CAPABILITY_SHAPE,
  ...RIPARIAN_SHAPE,
  ...COORDINATES_SHAPE,
});

export const StandardFinalFormSchema = z.object({
  ...APPLICANT_SHAPE,
  paymentType: PAYMENT_SHAPE.paymentType.describe(
    `How the $1,000 final-application fee will be paid. ${PAYMENT_TYPE_VALUES}`
  ),
  scopingSessionDate: z
    .string()
    .nullable()
    .describe(
      "Date the public scoping session on the draft application was held. The " +
        "final application is submitted after that session."
    ),
  ...PROPOSAL_SHAPE,
  ...INTERAGENCY_SHAPE,
  ...ENVIRONMENT_SHAPE,
  ...STOCK_WATER_SHAPE,
  ...OPERATIONS_SHARED_SHAPE,
  gearItems: z
    .array(GearItemSchema)
    .nullable()
    .describe(
      "Every item of gear, every longline, mooring and buoy deployed within the " +
        "boundaries. A row with only a type is a correct partial record."
    ),
  bottomPlantedSpecies: z
    .string()
    .nullable()
    .describe("All species that will be bottom planted, when bottom planting is proposed."),
  bottomPlantingAreas: z
    .string()
    .nullable()
    .describe(
      "The areas of the site where bottom planting would occur; 'the entire " +
        "site' when that is the answer."
    ),
  seedingMonths: z.string().nullable().describe("Months seeding will occur."),
  maxSeedingDays: z
    .number()
    .nullable()
    .describe("Maximum number of days it will take to seed the site."),
  ...EQUIPMENT_SHARED_SHAPE,
  lightingGlareMeasures: z
    .string()
    .nullable()
    .describe(
      "Measures ensuring exterior lighting illuminates only the target area and reduces glare."
    ),
  generatorFuel: GeneratorFuel.nullable().describe(
    "'gasoline', 'diesel', or 'other' with the fuel named in the note field."
  ),
  generatorFuelOther: z.string().nullable(),
  ...STRUCTURES_SHARED_SHAPE,
  floatingStructureHeightFt: z
    .number()
    .nullable()
    .describe("Height in feet as measured from the water line."),
  floatingStructureMaterials: z.string().nullable().describe("Construction materials."),
  floatingStructureGlareMeasures: z
    .string()
    .nullable()
    .describe("Measures keeping the structure's lighting on the target area and reducing glare."),
  buildingRoofingMaterials: z
    .string()
    .nullable()
    .describe("Roofing materials. They cannot be reflective or glossy."),
  buildingSidingMaterials: z
    .string()
    .nullable()
    .describe("Siding materials. They cannot be reflective or glossy."),
  ...VESSELS_SHARED_SHAPE,
  launchSites: z
    .array(LaunchSite)
    .nullable()
    .describe(`Where service vessels will be launched from, all that apply. ${LAUNCH_SITE_VALUES}`),
  launchSiteOtherNote: z.string().nullable(),
  ...EXISTING_USES_SHAPE,
  ...OTHER_SITES_SHAPE,
  ...CAPABILITY_SHAPE,
  ...RIPARIAN_SHAPE,
  ...COORDINATES_SHAPE,
});

export type StandardDraftForm = z.infer<typeof StandardDraftFormSchema>;
export type StandardDraftFormKey = keyof StandardDraftForm;
export type StandardFinalForm = z.infer<typeof StandardFinalFormSchema>;
export type StandardFinalFormKey = keyof StandardFinalForm;

/* -------------------------------------------------------------------------- */
/* The applications: each form plus the shared meta keys                       */
/* -------------------------------------------------------------------------- */

const META_SHAPE = {
  externalRequirements: z.record(z.string(), RequirementStatus),
  pendingConcern: z.string().nullable(),
  deferredFields: z.array(z.string()),
  stalledOn: z.string().nullable(),
};

export const StandardDraftApplicationSchema = StandardDraftFormSchema.extend(META_SHAPE);
export const StandardFinalApplicationSchema = StandardFinalFormSchema.extend(META_SHAPE);

export type StandardDraftApplication = z.infer<typeof StandardDraftApplicationSchema>;
export type StandardFinalApplication = z.infer<typeof StandardFinalApplicationSchema>;

export const EMPTY_STANDARD_DRAFT_APPLICATION: StandardDraftApplication = {
  ...(Object.fromEntries(
    Object.keys(StandardDraftFormSchema.shape).map((key) => [key, null])
  ) as unknown as StandardDraftForm),
  externalRequirements: {},
  pendingConcern: null,
  deferredFields: [],
  stalledOn: null,
};

export const EMPTY_STANDARD_FINAL_APPLICATION: StandardFinalApplication = {
  ...(Object.fromEntries(
    Object.keys(StandardFinalFormSchema.shape).map((key) => [key, null])
  ) as unknown as StandardFinalForm),
  externalRequirements: {},
  pendingConcern: null,
  deferredFields: [],
  stalledOn: null,
};

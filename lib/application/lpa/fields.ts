/**
 * The human-facing catalog of LPA application fields: what each one is called,
 * how to ask for it in conversation, and when it applies at all.
 *
 * `schema.ts` says what the data *is*; this file says what to *do* with it.
 * Keeping them apart means the extraction model reads terse machine-oriented
 * descriptions while the applicant reads plain questions, and neither has to
 * compromise for the other.
 *
 * Order matters: fields are listed in the order the printed form asks them, and
 * both the interview and the review screen walk this list top to bottom.
 *
 * The `appliesWhen` predicates are the interesting part. The LPA form is full of
 * branches — you only supply a riparian landowner list if there's shorefront
 * within 300 feet, you only describe bird deterrence if you're hanging shellfish
 * in the water column. Encoding those here means the interview never asks a
 * question the applicant's own answers have already ruled out, and the review
 * screen never shows a field as "missing" when the form wouldn't ask for it.
 */
import {
  SUSPENDED_SHELLFISH_GEAR,
  type LpaApplication,
  type LpaFormKey,
  type UseObservation,
} from "./schema";

export type SectionId =
  | "applicant"
  | "existing_activities"
  | "assistants"
  | "location"
  | "water_quality"
  | "species_stock"
  | "site_characteristics"
  | "existing_uses"
  | "vicinity"
  | "gear"
  | "bird_deterrence"
  | "riparian";

export interface Section {
  id: SectionId;
  title: string;
  /** One line of orientation, shown when the interview moves into the section. */
  blurb: string;
}

export const LPA_SECTIONS: Section[] = [
  {
    id: "applicant",
    title: "Applicant information",
    blurb: "Who's applying and how DMR should reach you.",
  },
  {
    id: "existing_activities",
    title: "Existing aquaculture activities",
    blurb: "Other LPAs you hold or assist on. No one may hold more than four.",
  },
  {
    id: "assistants",
    title: "Assistants and supervision",
    blurb: "Who else may work the site, and whether you claim an owner/operator exemption.",
  },
  { id: "location", title: "Location of the license site", blurb: "Where the site is, exactly." },
  {
    id: "water_quality",
    title: "Water quality classification",
    blurb: "DMR's growing-area classification for the water you'll be in.",
  },
  {
    id: "species_stock",
    title: "Species and source of stock",
    blurb: "What you'll grow and where the seed or stock comes from.",
  },
  {
    id: "site_characteristics",
    title: "Site characteristics",
    blurb: "The physical site: uplands, bottom, depth, and protected features.",
  },
  {
    id: "existing_uses",
    title: "Existing uses of the area",
    blurb: "How the water around your site is already being used, and your effect on it.",
  },
  {
    id: "vicinity",
    title: "Vicinity map features",
    blurb: "Anything within 1,000 feet that your site could affect.",
  },
  { id: "gear", title: "Gear description and layout", blurb: "Every item going in the water." },
  {
    id: "bird_deterrence",
    title: "Bird deterrence",
    blurb: "Required for suspended shellfish culture under the NSSP Model Ordinance.",
  },
  {
    id: "riparian",
    title: "Riparian notification",
    blurb: "Shorefront owners within 300 feet, who must be notified by certified mail.",
  },
];

export function sectionById(id: SectionId): Section {
  const section = LPA_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown LPA section: ${id}`);
  return section;
}

export interface LpaFieldDef {
  key: LpaFormKey;
  section: SectionId;
  /** Short label for the sidebar and review screen. */
  label: string;
  /** How to ask for it in conversation. */
  question: string;
  /** Extra context worth showing the applicant, where the form is unobvious. */
  hint?: string;
  /**
   * When present, the field is only part of the application if this returns
   * true. Absent means "always required".
   */
  appliesWhen?: (app: LpaApplication) => boolean;
  /**
   * True when an empty list is a real answer ("no assistants") rather than an
   * unanswered question.
   */
  emptyListIsAnswer?: boolean;
  /** Composite objects need their own notion of "filled in". */
  kind?: "use_observation";
}

/* -------------------------------------------------------------------------- */
/* Conditions shared by several fields and by the requirements catalog          */
/* -------------------------------------------------------------------------- */

/**
 * Sites in marina slips, lobster pounds and similar controlled areas are exempt
 * from riparian notification entirely; otherwise it applies whenever there's
 * shorefront within 300 feet.
 */
export function riparianNotificationRequired(app: LpaApplication): boolean {
  return app.hasShorefrontWithin300Ft === true && app.isMarinaOrPoundSite !== true;
}

/** Suspended shellfish gear triggers the bird-deterrence narrative. */
export function usesSuspendedShellfishGear(app: LpaApplication): boolean {
  return (app.gearCategories ?? []).some((category) =>
    SUSPENDED_SHELLFISH_GEAR.includes(category)
  );
}

/**
 * Sites above extreme low water — which the form treats as five feet of water or
 * less at mean low water — need a municipal shellfish committee signature in
 * towns with a shellfish management program.
 */
export function isShallowOrIntertidal(app: LpaApplication): boolean {
  if (app.isAboveExtremeLowWater === true || app.isAboveMeanLowWater === true) return true;
  return app.depthAtMeanLowWaterFt !== null && app.depthAtMeanLowWaterFt <= 5;
}

/* -------------------------------------------------------------------------- */
/* The catalog                                                                 */
/* -------------------------------------------------------------------------- */

export const LPA_FIELDS: LpaFieldDef[] = [
  /* --- Applicant information --- */
  {
    key: "applicantName",
    section: "applicant",
    label: "Applicant name",
    question: "What's your full name, as it should appear on the license?",
  },
  {
    key: "applicantAddress",
    section: "applicant",
    label: "Street address",
    question: "What's your mailing street address?",
  },
  { key: "applicantCity", section: "applicant", label: "City", question: "Which city or town?" },
  {
    key: "applicantStateZip",
    section: "applicant",
    label: "State and ZIP",
    question: "And the state and ZIP code?",
  },
  {
    key: "applicantTelephone",
    section: "applicant",
    label: "Telephone",
    question: "What's the best phone number for you?",
  },
  {
    key: "applicantEmail",
    section: "applicant",
    label: "Email",
    question: "What email address should DMR use to contact you?",
    hint: "Email is DMR's primary means of contact, and not replying within 30 days is grounds for denial.",
  },
  {
    key: "applicantDateOfBirth",
    section: "applicant",
    label: "Date of birth",
    question: "What's your date of birth?",
    hint: "Applicants must be at least 12 years old.",
  },
  {
    key: "isMaineResident",
    section: "applicant",
    label: "Maine resident",
    question: "Are you a Maine resident?",
    hint: "The fee is $100 for Maine residents and $400 for non-residents. The form counts you as a resident if you're registered to vote in Maine, hold a Maine driver's license, registered a vehicle in Maine, or filed a Maine income tax return.",
  },
  {
    key: "hasPreviouslyAppliedForSite",
    section: "applicant",
    label: "Prior submission",
    question: "Have you applied for this same site before?",
  },
  {
    key: "previousLpaAcronyms",
    section: "applicant",
    label: "Previous LPA acronyms",
    question: "Which LPA acronym(s) did those earlier applications use?",
    appliesWhen: (app) => app.hasPreviouslyAppliedForSite === true,
  },
  {
    key: "paymentType",
    section: "applicant",
    label: "Payment type",
    question: "Will you pay the application fee by check or credit card?",
    hint: "Checks go in with the application, payable to \"Treasurer, State of Maine\". Never mail credit card details; DMR will contact you for those.",
  },

  /* --- Existing aquaculture activities --- */
  {
    key: "holdsOtherLpaLicenses",
    section: "existing_activities",
    label: "Other LPA licenses",
    question: "Do you currently hold any other LPA licenses?",
    hint: "No one may hold more than four LPA licenses at a time.",
  },
  {
    key: "otherLpaAcronyms",
    section: "existing_activities",
    label: "Other LPA acronyms",
    question: "What are the acronyms of those LPA licenses?",
    appliesWhen: (app) => app.holdsOtherLpaLicenses === true,
  },
  {
    key: "isAssistantOnOtherLpas",
    section: "existing_activities",
    label: "Assistant elsewhere",
    question: "Are you listed as an assistant on anyone else's LPA license?",
  },
  {
    key: "assistantLpaAcronyms",
    section: "existing_activities",
    label: "LPAs you assist on",
    question: "Which LPA acronyms are those?",
    appliesWhen: (app) => app.isAssistantOnOtherLpas === true,
  },

  /* --- Assistants and supervision --- */
  {
    key: "assistantNames",
    section: "assistants",
    label: "Assistants",
    question:
      "Do you want to designate any unlicensed assistants to help work the site? You may name up to three, or say none.",
    hint: "Assistants can't be changed until the license is renewed.",
    emptyListIsAnswer: true,
  },
  {
    key: "primaryAssistantName",
    section: "assistants",
    label: "Primary assistant",
    question:
      "Would you like to designate one of them as your primary assistant, the person who can supervise the site when you're not there?",
    appliesWhen: (app) => (app.assistantNames ?? []).length > 0,
  },
  {
    key: "primaryAssistantEmail",
    section: "assistants",
    label: "Primary assistant email",
    question: "What's your primary assistant's email address?",
    appliesWhen: (app) => Boolean(app.primaryAssistantName),
  },
  {
    key: "ownerOperatorExemption",
    section: "assistants",
    label: "Owner/operator exemption",
    question:
      "Are you claiming an exemption from the owner/operator requirement? That applies if you hold or have applied for an experimental or standard lease, own 50% or more of a company that does, or this is an upweller-only site. Otherwise, no exemption.",
  },
  {
    key: "exemptionLeaseAcronym",
    section: "assistants",
    label: "Exemption lease acronym",
    question: "What's the acronym of the lease that supports your exemption?",
    appliesWhen: (app) =>
      app.ownerOperatorExemption === "lease_in_own_name" ||
      app.ownerOperatorExemption === "ownership_interest_50_plus",
  },
  {
    key: "exemptionCompanyName",
    section: "assistants",
    label: "Exemption company",
    question: "What's the name of the company that holds or applied for the lease?",
    appliesWhen: (app) =>
      app.ownerOperatorExemption === "ownership_interest_50_plus" ||
      app.ownerOperatorExemption === "ownership_interest_in_applicant_company",
  },
  {
    key: "exemptionOwnershipPercent",
    section: "assistants",
    label: "Ownership percentage",
    question: "What percentage of that company do you own?",
    appliesWhen: (app) => app.ownerOperatorExemption === "ownership_interest_50_plus",
  },

  /* --- Location --- */
  { key: "town", section: "location", label: "Town", question: "Which town is the site in?" },
  { key: "county", section: "location", label: "County", question: "And which county?" },
  {
    key: "waterbody",
    section: "location",
    label: "Waterbody",
    question: "What's the name of the waterbody?",
  },
  {
    key: "siteDescription",
    section: "location",
    label: "Site description",
    question: "How would you describe where the site sits? A landmark or a bearing works, something like \"south of Hog Island\".",
  },
  {
    key: "latitude",
    section: "location",
    label: "Latitude",
    question: "What's the latitude of the center point of the site, in decimal degrees (e.g. 43.123456)?",
  },
  {
    key: "longitude",
    section: "location",
    label: "Longitude",
    question: "And the longitude, in decimal degrees (e.g. -69.123456)?",
  },
  {
    key: "lpaHealthZone",
    section: "location",
    // Naming the zones in the question rather than linking out: this is a
    // question we are asking, so sending the applicant away to answer it mid-form
    // is the app failing at its job. The five zones and their boundaries are
    // fixed by DMR Rule 2.05(1)(J). Note zones 4 and 5 are carve-outs that sit
    // inside zone 3's stretch of coast, which is exactly the sort of thing an
    // applicant gets wrong.
    label: "LPA health zone",
    question:
      "Which LPA health zone is the site in? There are five: Zone 1, the St. Croix River down to West Quoddy Head; Zone 2, West Quoddy Head to Schoodic Point; Zone 3, Schoodic Point to the New Hampshire border; Zone 4, the Damariscotta River; and Zone 5, Casco Bay. Zones 4 and 5 sit inside Zone 3's stretch of coast, so if you're on the Damariscotta or in Casco Bay, use those.",
    hint: "Set by DMR Rule Chapter 2.05(1)(J). Any wild stock or seed has to come from this same zone. Stock from an approved hatchery is the exception. DMR publishes an interactive zone map if you're near a boundary.",
  },
  {
    key: "isAboveMeanLowWater",
    section: "location",
    label: "Above mean low water",
    question: "Is the site above the mean low water mark, meaning it sits in the intertidal zone?",
    hint: "If yes, the riparian landowner of the adjacent upland has to sign the application.",
  },
  {
    key: "isAboveExtremeLowWater",
    section: "location",
    label: "Above extreme low water",
    question: "Is the site in five feet of water or less at mean low water?",
    appliesWhen: (app) => app.isAboveMeanLowWater === false,
  },
  {
    key: "isMarinaOrPoundSite",
    section: "location",
    label: "Marina or pound site",
    question:
      "Is the site inside a marina slip, lobster pound, or similar enclosed area that someone controls access to?",
    hint: "These sites are exempt from riparian notification and from the four-per-1,000-feet density limit.",
  },
  {
    key: "municipalityHasHarbormaster",
    section: "location",
    label: "Town has harbormaster",
    question: "Does the town have a harbormaster?",
    hint: "If not, a municipal officer signs the application instead.",
  },
  {
    key: "purpose",
    section: "location",
    label: "Purpose",
    question:
      "Is this commercial, recreational, scientific, or educational? Commercial means the product is ultimately sold.",
  },

  /* --- Water quality --- */
  {
    key: "growingAreaDesignation",
    section: "water_quality",
    label: "Growing area designation",
    question: "What's DMR's growing area designation for the site, e.g. WA(A) or WA(P1)?",
    hint: "Look it up on DMR's shellfish closures and aquaculture leases map.",
  },
  {
    key: "isInRestrictedOrProhibitedArea",
    section: "water_quality",
    label: "Restricted or prohibited area",
    question:
      "Is that area classified as prohibited, restricted, or conditionally restricted?",
  },
  {
    key: "restrictedAreaRequirementsAcknowledged",
    section: "water_quality",
    label: "Restricted-area requirements",
    question:
      "Do you understand and accept the restricted-area conditions: seed only, within the Chapter 2.95(A)(4) size limits, moved only to a lease site after contacting DMR, and you must hold or have an ownership stake in a lease?",
    appliesWhen: (app) => app.isInRestrictedOrProhibitedArea === true,
  },
  {
    key: "associatedLeaseSiteIds",
    section: "water_quality",
    label: "Associated lease sites",
    question: "Which lease site IDs, and who holds them?",
    appliesWhen: (app) => app.isInRestrictedOrProhibitedArea === true,
  },

  /* --- Species and stock --- */
  {
    key: "hatcheryStock",
    section: "species_stock",
    label: "Hatchery-sourced species",
    question:
      "Which species will you source from a DMR-approved hatchery, and what's the hatchery's name, address, and phone number?",
    hint: "Quahog, surf clams, soft-shell clam, razor clam, European oyster and bay scallop can only come from an approved hatchery.",
    emptyListIsAnswer: true,
  },
  {
    key: "wildStock",
    section: "species_stock",
    label: "Wild-sourced species",
    question:
      "Will you source anything from the wild or another aquaculture site? If so, which species, from which waterbody and health zone, and who's the licensed harvester?",
    hint: "Wild stock must come from the same health zone as your LPA. American oysters can't come from the Damariscotta, Sheepscot, or Quahog Bay.",
    emptyListIsAnswer: true,
  },
  {
    key: "wildTakeComplianceAcknowledged",
    section: "species_stock",
    label: "Wild take certification",
    question:
      "Can you confirm you understand that wild-collected organisms must comply with all take laws and come from your LPA's health zone?",
    appliesWhen: (app) => (app.wildStock ?? []).length > 0,
  },
  {
    key: "scallopAdductorOnlyAcknowledged",
    section: "species_stock",
    label: "Scallop adductor-only",
    question:
      "Can you confirm that scallops grown here will be sold adductor-only, given that roe-on and whole scallop sales are prohibited on an LPA?",
    // Entries here are model-extracted and round-trip through JSONB, so this
    // reads defensively rather than trusting the schema's shape at runtime.
    appliesWhen: (app) =>
      [...(app.hatcheryStock ?? []), ...(app.wildStock ?? [])].some((entry) =>
        typeof entry?.species === "string" && entry.species.toLowerCase().includes("scallop")
      ),
  },

  /* --- Site characteristics --- */
  {
    key: "uplandsDescription",
    section: "site_characteristics",
    label: "Surrounding uplands",
    question: "How would you describe the land around the site: forested, residential, farmland, commercial?",
  },
  {
    key: "bottomCharacteristics",
    section: "site_characteristics",
    label: "Bottom characteristics",
    question: "What's the bottom like, including the substrate and any plants or animals on it?",
  },
  {
    key: "depthAtMeanLowWaterFt",
    section: "site_characteristics",
    label: "Depth at MLW (ft)",
    question: "How deep is the site at mean low water, in feet?",
  },
  {
    key: "depthAtMeanHighWaterFt",
    section: "site_characteristics",
    label: "Depth at MHW (ft)",
    question: "And at mean high water?",
  },
  {
    key: "isInEssentialHabitat",
    section: "site_characteristics",
    label: "Essential Habitat",
    question: "Is the site inside an area MDIFW has designated as Essential Habitat?",
    hint: "An LPA cannot be located in Essential Habitat.",
  },
  {
    key: "hasEagleNestWithin660Ft",
    section: "site_characteristics",
    label: "Eagle nest within 660 ft",
    question: "Is there an eagle's nest within 660 feet of the proposed site?",
  },
  {
    key: "eelgrassDescription",
    section: "site_characteristics",
    label: "Eelgrass",
    question:
      "Are there eelgrass beds on or near the site? If so, where are they and how far from the site? If not, just say none.",
  },
  {
    key: "eelgrassObservedMonth",
    section: "site_characteristics",
    label: "Eelgrass observed (month)",
    question: "In which month did you make those eelgrass observations?",
    appliesWhen: (app) =>
      Boolean(app.eelgrassDescription) &&
      app.eelgrassDescription!.trim().toLowerCase() !== "none",
  },
  {
    key: "eelgrassObservedYear",
    section: "site_characteristics",
    label: "Eelgrass observed (year)",
    question: "And which year?",
    appliesWhen: (app) =>
      Boolean(app.eelgrassDescription) &&
      app.eelgrassDescription!.trim().toLowerCase() !== "none",
  },

  /* --- Existing uses --- */
  {
    key: "commercialFishingUse",
    section: "existing_uses",
    label: "Commercial fishing",
    kind: "use_observation",
    question:
      "Tell me about commercial fishing around the site: what type happens there, in which seasons, how often, whether it happens inside your proposed boundaries (and if not, where relative to them), and what impact you expect your site to have on it.",
  },
  {
    key: "recreationalFishingUse",
    section: "existing_uses",
    label: "Recreational fishing",
    kind: "use_observation",
    question:
      "Now the same for recreational fishing: what type, which seasons, how often, whether it occurs inside your site boundaries, and the impact you anticipate.",
  },
  {
    key: "boatingUse",
    section: "existing_uses",
    label: "Boating",
    kind: "use_observation",
    question:
      "And boating: what kind (commercial, recreational), which seasons, how often, whether it happens within your site, and your anticipated impact.",
  },
  {
    key: "otherWaterUse",
    section: "existing_uses",
    label: "Other water uses",
    kind: "use_observation",
    question:
      "Last one: other water-related uses like kayaking or swimming. What type, which seasons, how often, whether they happen inside the site, and the impact you anticipate.",
  },

  /* --- Vicinity --- */
  {
    key: "hasNoNearbyFeatures",
    section: "vicinity",
    label: "Nothing within 1,000 ft",
    question:
      "Within 1,000 feet of the site, is there any federal navigation project or anchorage, navigational channel, structure, other aquaculture lease or LPA, anchorage or mooring, state or federal beach, or docking facility? Answer no if the site is clear of all of them.",
  },
  {
    key: "nearbyFeatures",
    section: "vicinity",
    label: "Nearby features and impacts",
    question:
      "Which of those are within 1,000 feet, and how will your site affect each one?",
    appliesWhen: (app) => app.hasNoNearbyFeatures === false,
  },

  /* --- Gear --- */
  {
    key: "gearCategories",
    section: "gear",
    label: "Gear categories",
    question:
      "Which gear categories are you seeking authorization for? The options are: no gear (bottom culture only), upweller, shellfish rafts, tray racks and overwintering cages, soft or semi-rigid bags and floating trays, lantern or pearl nets, scallop spat collector bags, scallop ear hangers, marine algae gear, and bottom anti-predator netting.",
  },
  {
    key: "gearItems",
    section: "gear",
    label: "Gear inventory",
    question:
      "Now list every individual item going in the water, including lines and moorings. For each: what it is, the maximum number you'll use, its dimensions, and the dates it'll be in the water.",
    appliesWhen: (app) => !(app.gearCategories ?? []).includes("no_gear_bottom_culture") ||
      (app.gearCategories ?? []).length > 1,
  },
  {
    key: "gearLayoutWidthFt",
    section: "gear",
    label: "Layout width (ft)",
    question: "What's the width of your maximum gear layout, in whole feet?",
    hint: "Gear excluding moorings may not exceed 400 square feet in total.",
  },
  {
    key: "gearLayoutLengthFt",
    section: "gear",
    label: "Layout length (ft)",
    question: "And the length, in whole feet?",
  },
  {
    key: "mooringDescription",
    section: "gear",
    label: "Moorings and tackle",
    question: "Describe the moorings and tackle: mooring type, bottom tackle, line, and so on.",
  },
  {
    key: "seasonalGearChanges",
    section: "gear",
    label: "Seasonal changes",
    question:
      "Will your gear deployment change seasonally, with cages sunk over winter or longlines pulled in summer? Describe it, or say there are no seasonal changes.",
  },

  /* --- Bird deterrence --- */
  {
    key: "birdDeterrenceMeasures",
    section: "bird_deterrence",
    label: "Bird deterrence measures",
    question:
      "Because you're suspending shellfish gear, DMR needs your plan for deterring roosting birds. What will you do? Common options are submerging gear before harvest, attaching physical deterrents, growing seed only, or keeping gear below the surface.",
    hint: "Washing bird waste into the water is explicitly not accepted as mitigation.",
    appliesWhen: usesSuspendedShellfishGear,
  },

  /* --- Riparian notification --- */
  {
    key: "hasShorefrontWithin300Ft",
    section: "riparian",
    label: "Shorefront within 300 ft",
    question:
      "Is there any shorefront land within 300 feet of the site, including intertidal land and state or federally owned land?",
  },
  {
    key: "riparianMunicipality",
    section: "riparian",
    label: "Certifying municipality",
    question: "Which municipality's tax records and clerk will certify the riparian landowner list?",
    appliesWhen: riparianNotificationRequired,
  },
  {
    key: "riparianLandowners",
    section: "riparian",
    label: "Riparian landowners",
    question:
      "List the shorefront parcels within 300 feet: for each, the tax map number, lot number, owner's name, and mailing address from the town's records.",
    hint: "If DMR finds the list incomplete the application is denied and the fee forfeited, so err on the side of including a parcel.",
    appliesWhen: riparianNotificationRequired,
  },
];

/* -------------------------------------------------------------------------- */
/* Applicability and answeredness                                              */
/* -------------------------------------------------------------------------- */

export function fieldApplies(field: LpaFieldDef, app: LpaApplication): boolean {
  return field.appliesWhen ? field.appliesWhen(app) : true;
}

/** A "Existing Uses" block counts as answered only when all five parts are filled. */
function isUseObservationAnswered(value: UseObservation | null): boolean {
  if (!value) return false;
  return Object.values(value).every((part) => typeof part === "string" && part.trim() !== "");
}

export function fieldAnswered(field: LpaFieldDef, app: LpaApplication): boolean {
  const value = app[field.key];

  if (field.kind === "use_observation") {
    return isUseObservationAnswered(value as UseObservation | null);
  }
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return field.emptyListIsAnswer ? true : value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

export function fieldsInSection(section: SectionId): LpaFieldDef[] {
  return LPA_FIELDS.filter((field) => field.section === section);
}

export function fieldByKey(key: LpaFormKey): LpaFieldDef | undefined {
  return LPA_FIELDS.find((field) => field.key === key);
}

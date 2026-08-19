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
  isHatcheryEligible,
  isWildEligible,
  soleTableFor,
  speciesShortLabel,
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

/* -------------------------------------------------------------------------- */
/* The form's two stock tables                                                  */
/* -------------------------------------------------------------------------- */

export type SourceTable = "hatchery" | "wild";

/**
 * The two tables, the column the form most needs from each, and how to name that
 * column to an applicant.
 *
 * Described here in one place because each table's state is worked out against
 * the other, which would otherwise be the same conditional written three times.
 */
export const SOURCE_TABLES: Record<
  SourceTable,
  { key: LpaFormKey; detail: string; detailLabel: string }
> = {
  hatchery: {
    key: "hatcherySources",
    detail: "hatcheryName",
    detailLabel: "the hatchery or facility's name",
  },
  wild: { key: "wildSources", detail: "waterbody", detailLabel: "the waterbody it comes from" },
};

function rowsIn(table: SourceTable, app: LpaApplication): Record<string, unknown>[] {
  // Widened through unknown on purpose. Rows are model-extracted and round-trip
  // through JSONB, so the shape the type claims is a hope, not a guarantee.
  const rows = app[SOURCE_TABLES[table].key] as unknown;
  if (!Array.isArray(rows)) return [];
  return (rows as unknown[]).filter(
    (row): row is Record<string, unknown> => !!row && typeof row === "object"
  );
}

function filled(value: unknown): boolean {
  return typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined;
}

/**
 * The species this table has a row for at all, however empty that row is.
 *
 * Placing a species is a separate act from describing where it comes from, and
 * conflating them is what made the interview loop. Told "wild stock", extraction
 * correctly opens a wild row for the mussel and leaves the columns null, because
 * it was told a source *table* and no details. If that does not count as placing
 * the species, the hatchery question goes on demanding a mussel the applicant has
 * already said is wild, and nothing they can say will stop it.
 */
export function speciesPlacedIn(table: SourceTable, app: LpaApplication): Set<string> {
  const placed = new Set<string>();
  for (const row of rowsIn(table, app)) {
    if (typeof row.species === "string") placed.add(row.species);
  }
  return placed;
}

/**
 * Rows that say something about a source but not the thing the form most needs.
 *
 * A hatchery's address and phone with no name is a *correct* partial record:
 * extraction is told to record the part it was given and leave the rest null.
 * Treating such a row as no source at all produced a loop that nothing the
 * applicant said could break, because the model had already recorded everything
 * it had and returned the same row every turn while the same question came back.
 *
 * So a row like this counts as placed, and the missing column is asked for by
 * name instead. Which is also a better question.
 */
export function rowsMissingDetail(table: SourceTable, app: LpaApplication): string[] {
  const { detail } = SOURCE_TABLES[table];
  const species: string[] = [];
  for (const row of rowsIn(table, app)) {
    if (typeof row.species !== "string") continue;
    if (filled(row[detail])) continue;
    species.push(row.species);
  }
  return species;
}

/**
 * The species this table still owes a source for.
 *
 * Which species a table owes is not a property of the table alone. A species
 * already sourced from a hatchery is accounted for and must not also be demanded
 * of the wild table, and the other way round.
 *
 * The three printed on both tables are owed by the **hatchery** table alone,
 * which is a decision worth being explicit about. Having both tables demand them
 * looks fairer and produces a loop: the wild question would keep asking about a
 * mussel that is going to come from a hatchery, and answering "none of it is
 * wild" would change nothing, so the same question would come back. Buying seed
 * in is also the ordinary case. So the hatchery question carries them, and its
 * wording offers the wild table as the alternative; answering it either way
 * settles the species.
 */
export function speciesAwaitingSource(table: SourceTable, app: LpaApplication): string[] {
  const chosen = Array.isArray(app.species) ? app.species : [];
  const other: SourceTable = table === "hatchery" ? "wild" : "hatchery";
  const here = speciesPlacedIn(table, app);
  const elsewhere = speciesPlacedIn(other, app);
  return chosen.filter((species) => {
    if (typeof species !== "string") return false;
    if (here.has(species) || elsewhere.has(species)) return false;
    const sole = soleTableFor(species);
    return sole === table || (sole === null && table === "hatchery");
  });
}

/** "a", "a and b", "a, b and c". */
function inWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * What this source table still needs, in the applicant's terms.
 *
 * Two different gaps, and telling them apart is what stops the question reading
 * as a repeat. A species with no row anywhere has not been placed, and the ask is
 * where it comes from. A row that has been placed but is missing the column the
 * form needs gets asked for that column by name. As answers arrive the question
 * narrows, so the applicant can see it moving even when the field is not yet
 * complete.
 *
 * Species are named after a colon rather than folded into the sentence, because
 * the form's printed names are capitalized and "your Hard clam/quahog" reads
 * like a mistake.
 */
function sourceQuestion(table: SourceTable, app: LpaApplication): string | null {
  const awaiting = speciesAwaitingSource(table, app).map(speciesShortLabel);
  const incomplete = rowsMissingDetail(table, app).map(speciesShortLabel);
  const asks: string[] = [];

  if (awaiting.length > 0) {
    asks.push(
      table === "hatchery"
        ? `Where will your seed come from? For each of these I need the hatchery or facility's name, address, and phone number: ${inWords(awaiting)}. If any of them are coming from the wild or another aquaculture site instead, just tell me that.`
        : `These can only come from the wild or from another aquaculture site: ${inWords(awaiting)}. For each one I need the waterbody, its health zone, and the licensed harvester's full name and license number.`
    );
  }

  if (incomplete.length > 0) {
    asks.push(
      table === "hatchery"
        ? `I still need the name of the hatchery or facility supplying ${inWords(incomplete)}.`
        : `I still need the waterbody ${inWords(incomplete)} will be harvested from, and its health zone.`
    );
  }

  return asks.length === 0 ? null : asks.join(" ");
}

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
  /**
   * A question written against the answers already given, used in place of
   * `question` when it returns something.
   *
   * Only the source tables need this, and they need it badly. "Where will your
   * seed come from?" is a fair question in the abstract and a poor one when the
   * app already knows it is waiting on the quahog and the mussel specifically.
   * A vague prompt is the reliable way to get a null back out of extraction.
   */
  questionFor?: (app: LpaApplication) => string | null;
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
  kind?: "use_observation" | "source_list";
  /** For a `source_list`, which of the form's two stock tables it is. */
  sourceTable?: SourceTable;
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
    hint: "Straight off a plotter or a phone is fine too, like 43\u00b039'02.2\"N. I'll convert it.",
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
    key: "species",
    section: "species_stock",
    label: "Species",
    question:
      "What are you planning to grow? The form's list is blue mussel, American/eastern oyster, hard clam/quahog, soft-shelled clam, Atlantic surf clam, Arctic surf clam, razor clam, green sea urchin, bay scallop, sea scallop, sugar kelp, skinny kelp, horsetail kelp, winged kelp, dulse, marine algae, and European oyster. Name anything that isn't on it and I'll record it under Other.",
    hint: "Just the species for now. Where each one comes from is the next question.",
  },
  {
    key: "otherSpeciesNote",
    section: "species_stock",
    label: "Other species",
    question: "Which species is it that isn't on the form's list?",
    appliesWhen: (app) => (app.species ?? []).includes("other"),
  },
  {
    key: "marineAlgaeNote",
    section: "species_stock",
    label: "Which marine algae",
    question: "Which marine algae are you growing?",
    appliesWhen: (app) => (app.species ?? []).includes("marine_algae"),
  },
  {
    key: "hatcherySources",
    section: "species_stock",
    kind: "source_list",
    sourceTable: "hatchery",
    label: "Hatchery sources",
    // A table nobody could put anything in is not part of this application. With
    // no species named yet neither table applies, which also keeps a blank draft
    // from reporting two questions answered before a word has been said: an
    // empty table owes nothing, so it would otherwise read as complete.
    appliesWhen: (app) => (app.species ?? []).some(isHatcheryEligible),
    question:
      "Where will your seed come from? For anything you're buying in, I need the hatchery or facility's name, address, and phone number.",
    questionFor: (app) => sourceQuestion("hatchery", app),
    hint: "Quahog, both surf clams, soft-shelled clam, razor clam, European oyster and bay scallop can only come from an approved hatchery. There's no approved European oyster hatchery at present.",
    emptyListIsAnswer: true,
  },
  {
    key: "wildSources",
    section: "species_stock",
    kind: "source_list",
    sourceTable: "wild",
    label: "Wild sources",
    appliesWhen: (app) => (app.species ?? []).some(isWildEligible),
    questionFor: (app) => sourceQuestion("wild", app),
    question:
      "Is anything coming from the wild or from another aquaculture site? If so, I need the waterbody, its health zone, and the licensed harvester's full name and license number. Only blue mussel, American oyster, sea scallop, green sea urchin and marine algae may be taken from the wild.",
    hint: "Wild stock must come from the same health zone as your LPA. American oysters can't come from the Damariscotta, the Sheepscot, or Quahog Bay.",
    emptyListIsAnswer: true,
  },
  {
    key: "wildTakeComplianceAcknowledged",
    section: "species_stock",
    label: "Wild take certification",
    question:
      "Can you confirm you understand that wild-collected organisms must comply with all take laws and come from your LPA's health zone?",
    appliesWhen: (app) => (app.wildSources ?? []).length > 0,
  },
  {
    key: "scallopAdductorOnlyAcknowledged",
    section: "species_stock",
    label: "Scallop adductor-only",
    question:
      "Can you confirm that scallops grown here will be sold adductor-only, given that roe-on and whole scallop sales are prohibited on an LPA?",
    // Matches the enum keys 'bay_scallop' and 'sea_scallop'. Reading the species
    // list directly is the point of the split: this used to scan both source
    // tables, so a scallop named before its hatchery was known raised no
    // certification at all.
    appliesWhen: (app) =>
      (app.species ?? []).some(
        (species) => typeof species === "string" && species.includes("scallop")
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
/**
 * An observation is answered once it says whether the use happens at all, plus
 * something about it if it does.
 *
 * Not "every box filled", which was the old rule. Extraction is told to record
 * the part it was given and leave the rest null, so demanding all five made a
 * partial answer count as no answer, and the question came back unchanged: the
 * same shape as the source-table loop found on 2026-08-19. Which boxes are still
 * blank is reported by `validateApplication`, where an incomplete answer belongs.
 */
function isUseObservationAnswered(value: UseObservation | null): boolean {
  if (!value || typeof value !== "object") return false;
  if (value.occurs === false) return true;
  if (value.occurs !== true) return false;
  return USE_OBSERVATION_BOXES.some((box) => {
    const part = (value as Record<string, unknown>)[box];
    return typeof part === "string" && part.trim() !== "";
  });
}

/** The form's five boxes for one kind of use, excluding "does it happen at all". */
export const USE_OBSERVATION_BOXES = [
  "activityTypes",
  "seasons",
  "frequency",
  "occursWithinSite",
  "anticipatedImpacts",
] as const;

/** Boxes still blank on an observation that says the use does happen. */
export function blankUseObservationBoxes(value: unknown): string[] {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== "object" || record.occurs !== true) return [];
  return USE_OBSERVATION_BOXES.filter((box) => {
    const part = record[box];
    return typeof part !== "string" || part.trim() === "";
  });
}

/**
 * A source table is answered once nothing is waiting on it.
 *
 * Completeness is measured against the species list rather than against the
 * table's own rows, which is what the split buys. Before it, a species and its
 * source were one record, so the only way to record "mussels" was to invent a
 * half-filled row and then remember it was half-filled. Now the question is
 * simply whether every species named has been placed somewhere.
 */
function isSourceListAnswered(field: LpaFieldDef, app: LpaApplication): boolean {
  if (!field.sourceTable) return false;
  return (
    speciesAwaitingSource(field.sourceTable, app).length === 0 &&
    rowsMissingDetail(field.sourceTable, app).length === 0
  );
}

/**
 * Whether the field holds anything worth reading back, which is a lower bar than
 * being answered.
 *
 * "What have I told you so far" is a different question from "what is still
 * outstanding". A hatchery table with one row filled in and one species still
 * waiting is not answered, but it plainly holds something, and an applicant
 * asking which hatchery they named should be told rather than shown nothing.
 */
export function fieldHasContent(field: LpaFieldDef, app: LpaApplication): boolean {
  const value = app[field.key];
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0 || Boolean(field.emptyListIsAnswer);
  if (typeof value === "object") {
    return Object.values(value).some((part) => part !== null && part !== "");
  }
  return true;
}

export function fieldAnswered(field: LpaFieldDef, app: LpaApplication): boolean {
  const value = app[field.key];

  if (field.kind === "use_observation") {
    return isUseObservationAnswered(value as UseObservation | null);
  }
  if (field.kind === "source_list") {
    return isSourceListAnswered(field, app);
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

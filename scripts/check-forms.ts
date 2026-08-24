/**
 * Deterministic checks over every registered application form: what can be
 * shown, saved, read back, converted, and migrated.
 *
 * Run it with `npm run check`. It needs no database, no API key and no model:
 * it is all pure functions, so it is fast and it can be run after any change to
 * a form's schema, its field list, its editors or its intake.
 *
 * The first half runs the same battery against *every* definition in the
 * registry, because the failure modes are properties of the three-file split —
 * schema, fields, editors — and a new form gets them all for free. A field with
 * no catalog entry never renders, a dropdown whose options the schema rejects
 * cannot be saved, and a row that arrives pre-answered ships a value nobody
 * chose. TypeScript catches a missing editor; it cannot catch these.
 *
 * The second half is per-form: the LPA's species-placement machinery and use
 * observations, the Experimental lease's caps, corners and windows.
 *
 * When something fails, the message names the field and the reason. Add a check
 * here rather than reasoning about it in the abstract.
 */
import {
  emptyEntry,
  missingRequiredParts,
  normalizeForSave,
  type Control,
  type RecordPart,
} from "@/lib/application/controls";
import { parseCoordinate } from "@/lib/application/coordinates";
import {
  fieldApplies,
  type AnyApplication,
  type LicenseDefinition,
} from "@/lib/application/definition";
import { applyEdit } from "@/lib/application/edits";
import {
  coerceExtracted,
  extractionShapeFor,
  fillMissing,
  formatCompletion,
  nextAsk,
  rejectedObject,
} from "@/lib/application/interview";
import { applicationProgress } from "@/lib/application/progress";
import { advanceApplication } from "@/lib/application/advance";
import {
  DEFINITIONS,
  definitionForApplication,
  definitionForLicenseType,
  migrateStoredApplication,
  seedApplication,
} from "@/lib/application/registry";
import { LicenseType } from "@/lib/routing/schema";
import { applicableRequirements } from "@/lib/application/requirements";

import { EXPERIMENTAL_DEFINITION } from "@/lib/application/experimental/definition";
import { validateApplication as validateExperimental } from "@/lib/application/experimental/progress";
import type { ExperimentalApplication } from "@/lib/application/experimental/schema";
import { EMPTY_EXPERIMENTAL_APPLICATION } from "@/lib/application/experimental/schema";

import {
  STANDARD_DRAFT_DEFINITION,
  STANDARD_FINAL_DEFINITION,
} from "@/lib/application/standard/definition";
import {
  validateDraftApplication as validateStandardDraft,
} from "@/lib/application/standard/progress";
import {
  EMPTY_STANDARD_DRAFT_APPLICATION,
  type StandardDraftApplication,
} from "@/lib/application/standard/schema";

import { LPA_DEFINITION } from "@/lib/application/lpa/definition";
import {
  blankUseObservationBoxes,
  fieldAnswered as lpaFieldAnswered,
  LPA_FIELDS,
  rowsMissingDetail,
  speciesAwaitingSource,
} from "@/lib/application/lpa/fields";
import { migrateApplication as migrateLpa } from "@/lib/application/lpa/normalize";
import { validateApplication as validateLpa } from "@/lib/application/lpa/progress";
import {
  CultivatedSpecies,
  EMPTY_LPA_APPLICATION,
  HatcherySpecies,
  isHatcheryEligible,
  isWildEligible,
  LpaFormSchema,
  soleTableFor,
  SPECIES_LABELS,
  WildSpecies,
  type LpaApplication,
} from "@/lib/application/lpa/schema";

let failures = 0;
function fail(message: string) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
}
function check(title: string, body: () => void) {
  const before = failures;
  body();
  console.log(`${failures === before ? "ok  " : "FAIL"}  ${title}`);
}

/** A value the control in question could actually produce, for round-tripping. */
function sampleFor(control: Control): unknown {
  switch (control.kind) {
    case "text":
      return "sample";
    case "textarea":
      return "sample text";
    case "number":
      return 3;
    case "date":
      return "2026-05-01";
    case "boolean":
      return true;
    case "choice":
      return control.choices[0]?.value ?? null;
    case "choice_list":
      return control.choices.slice(0, 2).map((choice) => choice.value);
    case "text_list":
      return ["one"];
    case "record":
      return filledRow(control.parts);
    case "record_list":
      return [filledRow(control.parts)];
  }
}
function filledRow(parts: RecordPart[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const part of parts) row[part.key] = sampleFor(part.control);
  return row;
}
function wrap(control: Control, row: Record<string, unknown>): unknown {
  return control.kind === "record_list" ? [row] : row;
}

/* -------------------------------------------------------------------------- */
/* The battery every form runs                                                 */
/* -------------------------------------------------------------------------- */

function checkDefinition(def: LicenseDefinition) {
  const FORM_KEYS = Object.keys(def.formSchema.shape);
  const FIELD_KEYS = def.fields.map((field) => field.key);
  const BLANK: AnyApplication = def.emptyApplication();

  check(`${def.id}: every field on the form is reachable on the review screen`, () => {
    for (const key of FORM_KEYS) {
      if (!FIELD_KEYS.includes(key)) {
        fail(`${key} has no field-catalog entry, so the review screen never renders it`);
      }
      if (!def.editors[key]) fail(`${key} has no editor control`);
    }
    for (const key of FIELD_KEYS) {
      if (!FORM_KEYS.includes(key)) fail(`the catalog has ${key}, which is not a field on the form`);
    }
    const duplicates = FIELD_KEYS.filter((key, i) => FIELD_KEYS.indexOf(key) !== i);
    if (duplicates.length > 0) fail(`duplicate catalog entries: ${duplicates.join(", ")}`);
    for (const field of def.fields) {
      if (!def.sections.some((section) => section.id === field.section)) {
        fail(`${field.key} is filed under an unknown section, ${field.section}`);
      }
    }
  });

  check(`${def.id}: what each control produces, the schema accepts`, () => {
    for (const key of FORM_KEYS) {
      const control = def.editors[key];
      if (!control) continue;
      const value = sampleFor(control);
      const parsed = def.formSchema.shape[key].safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        fail(`${key} (${control.kind}) sent ${JSON.stringify(value)} and was rejected: ${issue.message}`);
      }
    }
  });

  check(`${def.id}: every option offered is one the schema accepts`, () => {
    for (const key of FORM_KEYS) {
      const control = def.editors[key];
      if (!control) continue;
      const attempt = (value: unknown, label: string) => {
        const parsed = def.formSchema.shape[key].safeParse(value);
        if (!parsed.success) fail(`${label} was rejected: ${parsed.error.issues[0].message}`);
      };
      if (control.kind === "choice") {
        for (const choice of control.choices) attempt(choice.value, `${key} = "${choice.value}"`);
      }
      if (control.kind === "choice_list") {
        for (const choice of control.choices) attempt([choice.value], `${key} = ["${choice.value}"]`);
      }
      if (control.kind !== "record" && control.kind !== "record_list") continue;
      for (const part of control.parts) {
        if (part.control.kind !== "choice" && part.control.kind !== "choice_list") continue;
        for (const choice of part.control.choices) {
          const row = filledRow(control.parts);
          row[part.key] = part.control.kind === "choice" ? choice.value : [choice.value];
          attempt(wrap(control, row), `${key}.${part.key} = "${choice.value}"`);
        }
      }
    }
  });

  check(`${def.id}: a newly added row is unanswered, and cannot be saved until it isn't`, () => {
    for (const key of FORM_KEYS) {
      const control = def.editors[key];
      if (!control || (control.kind !== "record" && control.kind !== "record_list")) continue;
      const row = emptyEntry(control.parts);
      const missing = missingRequiredParts(control.parts, row);

      for (const part of control.parts) {
        if (part.required && part.control.kind === "choice" && row[part.key] !== null) {
          fail(`${key}.${part.key} arrives pre-filled with "${String(row[part.key])}" on a new row`);
        }
      }
      // A row the schema rejects with nothing named would enable Save and then
      // fail on the server with a message about the shape rather than the blank.
      const parsed = def.formSchema.shape[key].safeParse(wrap(control, row));
      if (!parsed.success && missing.length === 0) {
        fail(`${key}: a new blank row is rejected but no required part is named, so Save fails`);
      }
    }
  });

  check(`${def.id}: every field can be set, and then cleared`, () => {
    for (const key of FORM_KEYS) {
      const control = def.editors[key];
      if (!control) continue;
      const set = applyEdit(def, BLANK, { type: "field", key, value: sampleFor(control) });
      if ("error" in set) {
        fail(`${key} could not be set: ${set.error}`);
        continue;
      }
      const cleared = applyEdit(def, set.application, { type: "field", key, value: null });
      if ("error" in cleared) fail(`${key} could not be cleared: ${cleared.error}`);
      else if (cleared.application[key] !== null) {
        fail(`${key} was not null after clearing`);
      }
    }
    // Yes/no controls have no third state to click, so the Clear button is the
    // only way back to unanswered, and it must leave the field unanswered.
    for (const field of def.fields) {
      if (def.editors[field.key]?.kind !== "boolean") continue;
      const yes = applyEdit(def, BLANK, { type: "field", key: field.key, value: true });
      if ("error" in yes) continue;
      const cleared = applyEdit(def, yes.application, { type: "field", key: field.key, value: null });
      if (!("error" in cleared) && def.fieldAnswered(field, cleared.application)) {
        fail(`${field.key} still reads as answered after being cleared`);
      }
    }
  });

  check(`${def.id}: emptying a list returns the field to unanswered`, () => {
    for (const field of def.fields) {
      const kind = def.editors[field.key]?.kind;
      if (kind !== "text_list" && kind !== "choice_list" && kind !== "record_list") continue;
      const stored = normalizeForSave([], Boolean(field.emptyListIsAnswer));
      if (field.emptyListIsAnswer) {
        // "None of these" is a real answer the form asks for, so it stays a list.
        if (!Array.isArray(stored)) fail(`${field.key}: "none" should stay an empty list`);
        continue;
      }
      if (stored !== null) fail(`${field.key}: emptying the list stored ${JSON.stringify(stored)}`);
      const saved = applyEdit(def, BLANK, { type: "field", key: field.key, value: stored });
      if ("error" in saved) fail(`${field.key}: ${saved.error}`);
      else if (def.fieldAnswered(field, saved.application)) {
        fail(`${field.key}: an emptied list still reads as answered`);
      }
    }
  });

  check(`${def.id}: nothing outside the form can be written through the field path`, () => {
    for (const key of ["externalRequirements", "licenseType", "deferredFields", "stalledOn", "predecessor"]) {
      const forbidden = applyEdit(def, BLANK, { type: "field", key, value: {} });
      if (!("error" in forbidden)) fail(`${key} was writable as if it were a form field`);
    }
    const invented = applyEdit(def, BLANK, { type: "field", key: "applicantSignature", value: "S.M." });
    if (!("error" in invented)) fail("a field that does not exist was accepted");
  });

  check(`${def.id}: editing the field under query answers the query`, () => {
    const key = FORM_KEYS.find((candidate) => def.editors[candidate]?.kind === "text");
    if (!key) return;
    const queried: AnyApplication = { ...BLANK, pendingConcern: key };
    const edited = applyEdit(def, queried, { type: "field", key, value: "corrected" });
    if ("error" in edited) fail(`editing the queried field failed: ${edited.error}`);
    else if (edited.application.pendingConcern !== null) {
      fail("pendingConcern survived a hand edit to the field it was querying");
    }
  });

  check(`${def.id}: requirement statuses are editable, and only to known values`, () => {
    const first = applicableRequirements(def, BLANK)[0];
    if (!first) {
      fail("no requirements apply to a blank application, so none can be tracked");
      return;
    }
    const done = applyEdit(def, BLANK, { type: "requirement", id: first.id, status: "done" });
    if ("error" in done) fail(`marking ${first.id} done failed: ${done.error}`);
    const nonsense = applyEdit(def, BLANK, { type: "requirement", id: first.id, status: "nearly" });
    if (!("error" in nonsense)) fail("an unknown status was accepted");
    const unknown = applyEdit(def, BLANK, { type: "requirement", id: "no-such-thing", status: "done" });
    if (!("error" in unknown)) fail("an unknown requirement was accepted");
  });

  check(`${def.id}: the counts in the header match the fields on the page`, () => {
    const filled = FORM_KEYS.reduce(
      (application, key) => {
        const control = def.editors[key];
        if (control) application[key] = sampleFor(control);
        return application;
      },
      { ...BLANK } as AnyApplication
    );

    for (const [label, application] of [["a blank draft", BLANK], ["a full draft", filled]] as const) {
      const progress = applicationProgress(def, application);
      const shown = def.fields.filter((field) => fieldApplies(field, application));
      const answered = shown.filter((field) => def.fieldAnswered(field, application)).length;
      console.log(
        `      ${label}: ${progress.answered}/${progress.applicable} answered, ${shown.length} fields shown`
      );
      if (progress.applicable !== shown.length) {
        fail(`${label}: the header counts ${progress.applicable} applicable, the page renders ${shown.length}`);
      }
      if (progress.answered !== answered) {
        fail(`${label}: the header counts ${progress.answered} answered, the page shows ${answered}`);
      }
      // An issue pinned to a field nobody can see is a warning that never arrives.
      for (const issue of def.validate(application)) {
        if (issue.field && !shown.some((field) => field.key === issue.field)) {
          fail(`${label}: a warning about ${issue.field} is attached to a field the page does not show`);
        }
      }
    }
  });
}

for (const def of Object.values(DEFINITIONS)) checkDefinition(def);

/* -------------------------------------------------------------------------- */
/* The registry itself                                                         */
/* -------------------------------------------------------------------------- */

check("a draft knows which form it belongs to, and old drafts read as LPAs", () => {
  const lpaDef = DEFINITIONS.lpa;
  const expDef = DEFINITIONS.experimental;
  if (!lpaDef || !expDef || !DEFINITIONS.standard_draft || !DEFINITIONS.standard_final) {
    fail("the registry is missing a definition it should have");
    return;
  }

  // Drafts written before the tag existed carry no licenseType. Every one of
  // them is an LPA, because the LPA was the only form.
  const untagged = migrateStoredApplication({ town: "Harpswell" });
  if (!untagged || definitionForApplication(untagged).id !== "lpa") {
    fail("an untagged draft did not read as an LPA");
  }
  if (untagged?.licenseType !== "lpa") fail("migration did not tag the untagged draft");

  const tagged = migrateStoredApplication({ licenseType: "experimental", town: "Belfast" });
  if (!tagged || definitionForApplication(tagged).id !== "experimental") {
    fail("a tagged experimental draft did not read as experimental");
  }
  if (tagged?.town !== "Belfast") fail("a tagged draft lost a field in migration");

  // Migrating twice must change nothing, or every save would drift.
  if (JSON.stringify(migrateStoredApplication(tagged)) !== JSON.stringify(tagged)) {
    fail("migrating an already-migrated draft changed it");
  }
  if (migrateStoredApplication(null) !== null) fail("no application did not migrate to null");

  // Seeding tags the draft, so it can never be orphaned.
  const seeded = seedApplication(expDef, {
    species: ["oysters"],
    gearType: "cages",
    siteAreaSqFt: 87120,
    leaseDurationYears: 3,
    isFirstTimeApplicant: true,
    wantsToTestBeforeCommitting: true,
    locationDescription: "off Sears Island",
  });
  if (seeded.licenseType !== "experimental") fail("seeding did not tag the draft");
});

/* -------------------------------------------------------------------------- */
/* LPA: species placement, coordinates, loops, observations                    */
/* -------------------------------------------------------------------------- */

const LPA = LPA_DEFINITION;
const LPA_BLANK: LpaApplication = { ...EMPTY_LPA_APPLICATION };

check("lpa: the species list covers both of the form's tables", () => {
  const cultivated = new Set<string>(CultivatedSpecies.options);
  for (const species of [...HatcherySpecies.options, ...WildSpecies.options]) {
    if (!cultivated.has(species)) fail(`${species} is on a source table but not on the species list`);
  }
  for (const species of CultivatedSpecies.options) {
    if (!SPECIES_LABELS[species]) fail(`${species} has no printed name`);
    if (!isHatcheryEligible(species) && !isWildEligible(species) && species !== "other") {
      fail(`${species} is on the species list but on neither table, so it can never be sourced`);
    }
  }
  // The three printed on both tables are the reason species and source are
  // separate fields at all: naming one settles nothing about where it comes from.
  const onBoth = CultivatedSpecies.options.filter((s) => soleTableFor(s) === null && s !== "other");
  if (onBoth.join(",") !== "blue_mussel,eastern_oyster,green_sea_urchin") {
    fail(`species printed on both tables should be mussel, oyster and urchin, got: ${onBoth.join(", ")}`);
  }
});

check("lpa: naming a species opens the source row the form leaves no choice about", () => {
  // Quahog is hatchery-only, sea scallop is wild-only, blue mussel is on both.
  const named = applyEdit(LPA, LPA_BLANK, {
    type: "field",
    key: "species",
    value: ["hard_clam_quahog", "sea_scallop", "blue_mussel"],
  });
  if ("error" in named) {
    fail(`naming species failed: ${named.error}`);
    return;
  }
  const app = named.application as LpaApplication;
  const hatchery = (app.hatcherySources ?? []).map((row) => row.species);
  const wild = (app.wildSources ?? []).map((row) => row.species);
  if (!hatchery.includes("hard_clam_quahog")) fail("quahog is hatchery-only but opened no hatchery row");
  if (!wild.includes("sea_scallop")) fail("sea scallop is wild-only but opened no wild row");
  if (hatchery.includes("blue_mussel") || wild.includes("blue_mussel")) {
    fail("blue mussel is on both tables and should have been left for the applicant to place");
  }

  // Idempotent: re-saving the same list must not stack a second row.
  const again = applyEdit(LPA, app, { type: "field", key: "species", value: app.species });
  if ("error" in again) fail(`re-saving the species list failed: ${again.error}`);
  else if (
    ((again.application as LpaApplication).hatcherySources ?? []).length !==
    (app.hatcherySources ?? []).length
  ) {
    fail("re-saving the same species list opened a duplicate row");
  }

  // A row the applicant deletes stays deleted, even though the species remains.
  const emptied = applyEdit(LPA, app, { type: "field", key: "hatcherySources", value: [] });
  if ("error" in emptied) fail(`clearing the hatchery table failed: ${emptied.error}`);
  else if (((emptied.application as LpaApplication).hatcherySources ?? []).length !== 0) {
    fail("a deleted source row came back");
  }
});

check("lpa: a species with no source keeps a table unanswered, without looping", () => {
  const named = applyEdit(LPA, LPA_BLANK, { type: "field", key: "species", value: ["blue_mussel"] });
  if ("error" in named) {
    fail(`naming species failed: ${named.error}`);
    return;
  }
  const app = named.application as LpaApplication;
  const hatcheryField = LPA_FIELDS.find((f) => f.key === "hatcherySources")!;
  const wildField = LPA_FIELDS.find((f) => f.key === "wildSources")!;

  // A mussel is printed on both tables, and the hatchery table alone carries it.
  if (lpaFieldAnswered(hatcheryField, app)) fail("an unsourced mussel left the hatchery table answered");
  if (!validateLpa(app).some((i) => i.message.includes("no source recorded"))) {
    fail("an unsourced species raised no warning");
  }

  // The property this rule exists for. If the wild table also demanded the
  // mussel, answering "none of it is wild" would change nothing and the same
  // question would come back forever.
  if (!lpaFieldAnswered(wildField, app)) {
    fail("the wild table demands a species the hatchery question already carries, which loops");
  }
  const noneWild = applyEdit(LPA, app, { type: "field", key: "wildSources", value: [] });
  if ("error" in noneWild) fail(`recording "nothing from the wild" failed: ${noneWild.error}`);
  else if (!lpaFieldAnswered(wildField, noneWild.application as LpaApplication)) {
    fail('answering "nothing from the wild" left the wild table unanswered');
  }

  const sourced = applyEdit(LPA, app, {
    type: "field",
    key: "wildSources",
    value: [{ species: "blue_mussel", waterbody: "Casco Bay", healthZone: null, harvesterName: null, harvesterLicenseNumber: null, aquacultureSiteId: null }],
  });
  if ("error" in sourced) {
    fail(`recording a wild source failed: ${sourced.error}`);
    return;
  }
  const sourcedApp = sourced.application as LpaApplication;
  // Sourced once is sourced. The other table must not go on demanding it.
  if (!lpaFieldAnswered(wildField, sourcedApp)) fail("a sourced mussel left the wild table unanswered");
  if (!lpaFieldAnswered(hatcheryField, sourcedApp)) {
    fail("a mussel sourced from the wild still leaves the hatchery table demanding it");
  }
  if (validateLpa(sourcedApp).some((i) => i.message.includes("no source recorded"))) {
    fail("a sourced species still raised a missing-source warning");
  }
});

check("lpa: a source for a species you are not growing is reported", () => {
  const stray = applyEdit(LPA, LPA_BLANK, {
    type: "field",
    key: "hatcherySources",
    value: [{ species: "bay_scallop", hatcheryName: "Somewhere", hatcheryAddress: null, hatcheryPhone: null }],
  });
  if ("error" in stray) {
    fail(`recording a stray source failed: ${stray.error}`);
    return;
  }
  if (!validateLpa(stray.application as LpaApplication).some((i) => i.message.includes("not among the species"))) {
    fail("a source for an unlisted species raised no warning");
  }
});

check("lpa: a draft written before the split still opens", () => {
  const legacy = {
    ...LPA_BLANK,
    species: undefined,
    hatcheryStock: [
      { species: "eastern_oyster", speciesNote: null, hatcheryName: "Mook Sea Farm", hatcheryAddress: "Walpole", hatcheryPhone: "207" },
      { species: "other", speciesNote: "periwinkles", hatcheryName: null, hatcheryAddress: null, hatcheryPhone: null },
    ],
    wildStock: [{ species: "sea_scallop", speciesNote: null, waterbody: "Casco Bay", healthZone: "3", harvesterName: null, harvesterLicenseNumber: null, aquacultureSiteId: null }],
    somethingTheFormNoLongerHas: "x",
    town: "Harpswell",
  };
  const migrated = migrateLpa(legacy);
  if (!migrated) {
    fail("a legacy draft migrated to nothing");
    return;
  }
  const species = migrated.species ?? [];
  for (const expected of ["eastern_oyster", "other", "sea_scallop"] as const) {
    if (!species.includes(expected)) fail(`${expected} was lost in migration`);
  }
  if (migrated.town !== "Harpswell") fail("an untouched field was lost in migration");
  if ("somethingTheFormNoLongerHas" in migrated) fail("a key the form no longer has survived migration");
  if ("hatcheryStock" in migrated) fail("the old stock key survived migration");
  if (migrated.otherSpeciesNote !== "periwinkles") fail("the per-row species note did not become the write-in");
  if ((migrated.hatcherySources ?? []).find((r) => r.species === "eastern_oyster")?.hatcheryName !== "Mook Sea Farm") {
    fail("a hatchery name was lost in migration");
  }
  if ((migrated.wildSources ?? []).find((r) => r.species === "sea_scallop")?.waterbody !== "Casco Bay") {
    fail("a waterbody was lost in migration");
  }
  // Loading twice must not change anything, or every save would drift.
  if (JSON.stringify(migrateLpa(migrated)) !== JSON.stringify(migrated)) {
    fail("migrating an already-migrated draft changed it");
  }
  if (migrateLpa(null) !== null) fail("a conversation with no application did not migrate to null");
});

check("a coordinate is read however the applicant's plotter shows it", () => {
  // The forms want decimal degrees and say so. A chartplotter, a handheld GPS
  // and the iPhone compass all show degrees, minutes and seconds, and that is
  // what gets typed. Every one of these was an answer the app used to lose.
  const cases: [unknown, "latitude" | "longitude", number | null][] = [
    [`43°39'02.2"N, 70°11'16.2"W`, "latitude", 43.650611],
    [`43°39'02.2"N, 70°11'16.2"W`, "longitude", -70.187833],
    [`43°39'02.2"N`, "latitude", 43.650611],
    [`70°11'16.2"W`, "longitude", -70.187833],
    ["43 39 02.2 N", "latitude", 43.650611],
    ["43° 39.0367' N", "latitude", 43.650611],
    ["43.650611, -70.187833", "latitude", 43.650611],
    ["43.650611, -70.187833", "longitude", -70.187833],
    [43.650611, "latitude", 43.650611],
    ["-70.187833", "longitude", -70.187833],
    ["70.187833 W", "longitude", -70.187833],
    [`10°30'00"S`, "latitude", -10.5],
    // Unreadable is null, never a guess.
    ["43 70 00 N", "latitude", null],
    ["43.65 39", "latitude", null],
    ["430.5", "latitude", null],
    ["somewhere off Hog Island", "latitude", null],
    ["", "latitude", null],
    [null, "latitude", null],
  ];
  for (const [input, axis, expected] of cases) {
    const got = parseCoordinate(input, axis);
    const ok = expected === null ? got === null : got !== null && Math.abs(got - expected) < 0.0001;
    if (!ok) fail(`${axis} of ${JSON.stringify(input)} read as ${got}, expected ${expected}`);
  }

  // A west longitude given without a sign or a letter stays positive on purpose,
  // so that validation reports it rather than this silently deciding what the
  // applicant meant.
  const unsigned = parseCoordinate("70.187833", "longitude");
  if (unsigned !== 70.187833) fail("an unsigned longitude should be left for validation to catch");
  const app = { ...LPA_BLANK, longitude: unsigned };
  if (!validateLpa(app).some((issue) => issue.field === "longitude")) {
    fail("a positive Maine longitude raised no warning");
  }
});

check("lpa: a half-filled source row moves the interview on rather than looping", () => {
  // The state a real conversation got stuck in on 2026-08-19.
  const stuck: LpaApplication = {
    ...LPA_BLANK,
    species: ["hard_clam_quahog", "sea_scallop", "blue_mussel"],
    hatcherySources: [
      { species: "hard_clam_quahog", hatcheryName: null, hatcheryAddress: "PO Box 204, Bremen, ME", hatcheryPhone: "207-100-1000" },
    ],
    wildSources: [
      { species: "sea_scallop", waterbody: null, healthZone: null, harvesterName: null, harvesterLicenseNumber: null, aquacultureSiteId: null },
      { species: "blue_mussel", waterbody: null, healthZone: null, harvesterName: null, harvesterLicenseNumber: null, aquacultureSiteId: null },
    ],
  };

  // A species with a row anywhere has been placed, however empty that row is.
  for (const table of ["hatchery", "wild"] as const) {
    const awaiting = speciesAwaitingSource(table, stuck);
    if (awaiting.length > 0) {
      fail(`${table} table still demands ${awaiting.join(", ")}, all of which have a row already`);
    }
  }

  // Still not answered, because the form needs the columns. The difference is
  // that the question now names them.
  const hatcheryField = LPA_FIELDS.find((f) => f.key === "hatcherySources")!;
  const wildField = LPA_FIELDS.find((f) => f.key === "wildSources")!;
  if (lpaFieldAnswered(hatcheryField, stuck)) fail("a hatchery row with no hatchery name counts as answered");
  if (lpaFieldAnswered(wildField, stuck)) fail("a wild row with no waterbody counts as answered");

  if (rowsMissingDetail("hatchery", stuck).join() !== "hard_clam_quahog") {
    fail("the quahog's missing hatchery name was not identified");
  }
  const asked = hatcheryField.questionFor?.(stuck) ?? "";
  if (!asked.includes("still need the name")) {
    fail(`the hatchery question should ask for the missing name, got: ${asked.slice(0, 80)}`);
  }
  if (asked === (hatcheryField.questionFor?.(LPA_BLANK) ?? hatcheryField.question)) {
    fail("the question did not change once a partial row existed, so it reads as a repeat");
  }

  // What is missing is a validity problem, reported, not a completeness one.
  const messages = validateLpa(stuck).map((issue) => issue.message).join(" ");
  if (!messages.includes("without the hatchery or facility's name")) {
    fail("a source row missing its key column raised no warning");
  }

  // And once the missing columns arrive, both tables are done.
  const complete: LpaApplication = {
    ...stuck,
    hatcherySources: [{ ...stuck.hatcherySources![0], hatcheryName: "Muscongus Bay Aquaculture" }],
    wildSources: stuck.wildSources!.map((row) => ({ ...row, waterbody: "Casco Bay", healthZone: "5" })),
  };
  if (!lpaFieldAnswered(hatcheryField, complete)) fail("a complete hatchery table still reads unanswered");
  if (!lpaFieldAnswered(wildField, complete)) fail("a complete wild table still reads unanswered");
});

check("a question the interview cannot land can be set aside", () => {
  const app: LpaApplication = { ...LPA_BLANK, species: ["sugar_kelp"] };
  const stuck = nextAsk(LPA, app)?.fields[0].key;
  if (!stuck) {
    fail("a blank application had nothing to ask about");
    return;
  }
  // Set aside, not resolved: the interview stops asking, and everything else
  // still counts it missing.
  const deferred: LpaApplication = { ...app, deferredFields: [stuck] };
  if (nextAsk(LPA, deferred)?.fields[0].key === stuck) {
    fail(`${stuck} was asked again after being set aside, which is how the interview loops`);
  }
  const field = LPA_FIELDS.find((f) => f.key === stuck)!;
  if (lpaFieldAnswered(field, deferred)) fail("setting a field aside made it count as answered");
  if (!applicationProgress(LPA, deferred).missing.some((f) => f.key === stuck)) {
    fail("a field set aside dropped out of the outstanding list, so it would be lost");
  }
  // And the closing message names them rather than claiming the form is done.
  const allDeferred: LpaApplication = {
    ...app,
    deferredFields: LPA_FIELDS.filter((f) => fieldApplies(f, app)).map((f) => f.key),
  };
  if (nextAsk(LPA, allDeferred) !== null) fail("something was still asked with every field set aside");
  if (!formatCompletion(LPA, allDeferred).includes("Set aside as we went")) {
    fail("the closing message claims the form is complete when fields were set aside");
  }
});

check('lpa: "none observed" is something an applicant can actually say', () => {
  const observationField = LPA_FIELDS.find((f) => f.kind === "use_observation")!;
  const blank = { activityTypes: null, seasons: null, frequency: null, occursWithinSite: null, anticipatedImpacts: null };

  const none: LpaApplication = { ...LPA_BLANK, [observationField.key]: { occurs: false, ...blank } };
  if (!lpaFieldAnswered(observationField, none)) {
    fail('"none observed" does not count as an answer, so the question repeats forever');
  }
  if (blankUseObservationBoxes(none[observationField.key]).length > 0) {
    fail('"none observed" was reported as having blank boxes, which it should not have to fill');
  }

  const unasked: LpaApplication = { ...LPA_BLANK, [observationField.key]: { occurs: null, ...blank } };
  if (lpaFieldAnswered(observationField, unasked)) fail("an untouched observation counts as answered");

  // Partial, in the way extraction is explicitly told to be partial.
  const partial: LpaApplication = {
    ...LPA_BLANK,
    [observationField.key]: { ...blank, occurs: true, activityTypes: "lobstering from small boats" },
  };
  if (!lpaFieldAnswered(observationField, partial)) {
    fail("a partly described use counts as no answer, which is how the interview loops");
  }
  if (blankUseObservationBoxes(partial[observationField.key]).length !== 4) {
    fail("the boxes still blank on a partly described use were not reported");
  }
  if (!validateLpa(partial).some((issue) => issue.field === observationField.key)) {
    fail("a partly described use raised no warning");
  }

  // The whole record must still be rejected if it arrives as a bare value, or
  // the review screen would try to render a boolean as five text boxes.
  if (LpaFormSchema.shape[observationField.key as "boatingUse"].safeParse(false).success) {
    fail("the schema accepts `false` in place of a whole observation record");
  }
});

check("lpa: an observation written before `occurs` existed still opens", () => {
  const legacy = {
    ...LPA_BLANK,
    commercialFishingUse: {
      activityTypes: "lobstering", seasons: "summer", frequency: "daily",
      occursWithinSite: "no, 200 feet west", anticipatedImpacts: "minimal",
    },
    boatingUse: { activityTypes: null, seasons: null, frequency: null, occursWithinSite: null, anticipatedImpacts: null },
  };
  const migrated = migrateLpa(legacy);
  if (!migrated) {
    fail("a legacy draft migrated to nothing");
    return;
  }
  if ((migrated.commercialFishingUse as { occurs?: unknown })?.occurs !== true) {
    fail("a described use did not migrate to occurs: true");
  }
  if ((migrated.boatingUse as { occurs?: unknown })?.occurs !== null) {
    fail("an empty observation was migrated into a claim about the site");
  }
  if (migrated.commercialFishingUse?.activityTypes !== "lobstering") {
    fail("migration lost what the applicant had described");
  }
});

check("one badly shaped field costs that field, not the turn", () => {
  const inner = Object.assign(new Error("Type validation failed"), {
    name: "AI_TypeValidationError",
    value: { town: "Harpswell", commercialFishingUse: false },
  });
  const outer = new Error("No object generated", { cause: inner });
  const found = rejectedObject(outer);
  if (found?.town !== "Harpswell") fail("the model's output could not be recovered from the error");
  if (rejectedObject(new Error("nothing to find")) !== null) {
    fail("an error carrying no object should yield null, not a guess");
  }
  // Must not loop on a self-referential cause chain.
  const loopy: { cause?: unknown } = {};
  loopy.cause = loopy;
  if (rejectedObject(loopy) !== null) fail("a circular cause chain did not terminate cleanly");

  // Per-field salvage: the good field parses, the bad one does not.
  if (!LpaFormSchema.shape.town.safeParse("Harpswell").success) fail("a good field failed to parse");
  if (LpaFormSchema.shape.commercialFishingUse.safeParse(false).success) {
    fail("the bad field parsed, so nothing would have been dropped");
  }
});

check("lpa: a record answered in part is completed, not thrown away", () => {
  const partial = fillMissing({ occurs: false }, LpaFormSchema.shape.commercialFishingUse);
  const parsed = LpaFormSchema.shape.commercialFishingUse.safeParse(partial);
  if (!parsed.success) {
    fail(`a record answered in part still does not parse: ${parsed.error.issues[0].message}`);
    return;
  }
  const observationField = LPA_FIELDS.find((f) => f.key === "commercialFishingUse")!;
  if (!lpaFieldAnswered(observationField, { ...LPA_BLANK, commercialFishingUse: parsed.data })) {
    fail("a completed partial record still does not count as answered");
  }

  // Filling gaps must never invent an answer: absent means null.
  const described = fillMissing(
    { occurs: true, activityTypes: "lobstering" },
    LpaFormSchema.shape.commercialFishingUse
  ) as Record<string, unknown>;
  if (described.activityTypes !== "lobstering") fail("filling gaps overwrote what the model said");
  if (described.seasons !== null) fail("a gap was filled with something other than null");

  // Rows inside a list get the same treatment, one level down.
  const rows = fillMissing(
    [{ species: "blue_mussel" }],
    LpaFormSchema.shape.hatcherySources
  );
  if (!LpaFormSchema.shape.hatcherySources.safeParse(rows).success) {
    fail("a source row given as species-only does not parse after filling");
  }

  // Values that are simply the wrong shape are still wrong, and must be dropped
  // rather than coerced into something the applicant never said.
  if (LpaFormSchema.shape.commercialFishingUse.safeParse(fillMissing(false, LpaFormSchema.shape.commercialFishingUse)).success) {
    fail("a bare false was repaired into a record, inventing an answer");
  }
});

check("lpa: the schema accepts the answer the model actually gives", () => {
  const field = LPA_FIELDS.find((f) => f.key === "boatingUse")!;
  const shape = extractionShapeFor(LPA, "boatingUse");

  const asNone = shape.safeParse(false);
  if (!asNone.success) {
    fail("the extraction schema still rejects a bare false for a use observation");
    return;
  }
  const none = coerceExtracted(LPA, "boatingUse", false) as LpaApplication["boatingUse"];
  if (none?.occurs !== false) fail("a bare false did not become an observation saying it does not occur");
  if (!lpaFieldAnswered(field, { ...LPA_BLANK, boatingUse: none })) {
    fail("a bare false did not count as an answer, so the question repeats");
  }
  if (!LpaFormSchema.shape.boatingUse.safeParse(none).success) {
    fail("what a bare false converts to is not storable on the form");
  }

  // A partial record has to survive too.
  if (!shape.safeParse({ occurs: true, activityTypes: "lobster boats" }).success) {
    fail("the extraction schema rejects a partly filled observation");
  }
  const partial = coerceExtracted(LPA, "boatingUse", {
    occurs: true,
    activityTypes: "lobster boats",
  }) as LpaApplication["boatingUse"];
  if (partial?.seasons !== null) fail("a partly filled observation was not completed with nulls");
  if (partial?.activityTypes !== "lobster boats") fail("completing an observation overwrote what was said");

  // A record saying nothing must read as "not mentioned".
  if (coerceExtracted(LPA, "boatingUse", {}) !== null) {
    fail("an empty observation is not treated as silence, so it would overwrite a real answer");
  }
  if (coerceExtracted(LPA, "boatingUse", null) !== null) fail("null did not stay null");

  // The stored form is unchanged.
  if (LpaFormSchema.shape.boatingUse.safeParse(false).success) {
    fail("the stored form accepts a bare false, which the review screen cannot render");
  }
});

/* -------------------------------------------------------------------------- */
/* Experimental: caps, corners, windows, seeding                               */
/* -------------------------------------------------------------------------- */

const EXP = EXPERIMENTAL_DEFINITION;
const EXP_BLANK: ExperimentalApplication = { ...EMPTY_EXPERIMENTAL_APPLICATION };

check("experimental: the regulatory caps block, at the cap they don't", () => {
  const over: ExperimentalApplication = { ...EXP_BLANK, totalAcreage: 4.5, leaseTermYears: 4 };
  const issues = validateExperimental(over);
  if (!issues.some((i) => i.field === "totalAcreage" && i.severity === "blocking")) {
    fail("4.5 acres did not block; the regulatory maximum is 4");
  }
  if (!issues.some((i) => i.field === "leaseTermYears" && i.severity === "blocking")) {
    fail("a 4-year term did not block; the regulatory maximum is 3");
  }
  const at: ExperimentalApplication = { ...EXP_BLANK, totalAcreage: 4, leaseTermYears: 3 };
  if (validateExperimental(at).some((i) => i.severity === "blocking")) {
    fail("an application at exactly the caps was blocked");
  }
});

check("experimental: corners are read however the plotter shows them", () => {
  const coerce = EXP.coercions!.corners;
  const rows = coerce([
    { latitude: `43°39'02.2"N`, longitude: `70°11'16.2"W` },
    { latitude: 43.6521, longitude: -70.1901 },
    { latitude: "somewhere near the ledge", longitude: "?" },
  ]) as { latitude: number; longitude: number }[] | null;
  if (!rows || rows.length !== 2) {
    fail(`three rows, one unreadable, should convert to two; got ${JSON.stringify(rows)}`);
    return;
  }
  if (Math.abs(rows[0].latitude - 43.650611) > 0.0001) fail("a DMS latitude converted wrongly");
  if (Math.abs(rows[0].longitude - -70.187833) > 0.0001) {
    fail("a DMS west longitude did not come out negative");
  }
  // What the coercion produces must be storable on the form.
  const parsed = EXP.formSchema.shape.corners.safeParse(rows);
  if (!parsed.success) fail("converted corners do not parse against the form schema");
  // Nothing readable means unanswered, never a guess.
  if (coerce([{ latitude: "off the point", longitude: "a ways out" }]) !== null) {
    fail("an all-unreadable corner list should become null and be asked again");
  }
  // Positive longitudes are left for validation to catch, and it catches them.
  const positive: ExperimentalApplication = {
    ...EXP_BLANK,
    corners: [
      { latitude: 43.65, longitude: 70.18 },
      { latitude: 43.66, longitude: 70.19 },
      { latitude: 43.64, longitude: 70.17 },
    ],
  };
  if (!validateExperimental(positive).some((i) => i.field === "corners" && i.message.includes("negative"))) {
    fail("a positive Maine longitude on a corner raised no warning");
  }
  // Two corners is not a site.
  const twoCorners: ExperimentalApplication = {
    ...EXP_BLANK,
    corners: [
      { latitude: 43.65, longitude: -70.18 },
      { latitude: 43.66, longitude: -70.19 },
    ],
  };
  if (!validateExperimental(twoCorners).some((i) => i.message.includes("at least three corners"))) {
    fail("a two-corner boundary raised no warning");
  }
});

check("experimental: observation windows and the ice rule are enforced", () => {
  const december: ExperimentalApplication = { ...EXP_BLANK, bottomObservationDate: "December 12, 2025" };
  if (!validateExperimental(december).some((i) => i.field === "bottomObservationDate")) {
    fail("a December observation date raised no warning; the window is April 1 to November 15");
  }
  const june: ExperimentalApplication = { ...EXP_BLANK, bottomObservationDate: "June 2026" };
  if (validateExperimental(june).some((i) => i.field === "bottomObservationDate")) {
    fail("a June observation date was wrongly flagged");
  }
  const vague: ExperimentalApplication = { ...EXP_BLANK, bottomObservationDate: "last summer" };
  if (validateExperimental(vague).some((i) => i.field === "bottomObservationDate")) {
    fail("an unparseable date was flagged; unreadable means don't judge");
  }
  const noIce: ExperimentalApplication = { ...EXP_BLANK, iceFormationDescription: "No ice observed." };
  if (!validateExperimental(noIce).some((i) => i.field === "iceFormationDescription")) {
    fail('a bare "no ice observed" raised no warning; DMR says plainly it is not accepted');
  }
  const withData: ExperimentalApplication = {
    ...EXP_BLANK,
    iceFormationDescription:
      "No ice inside the boundaries in the last ten winters per the harbormaster's records, 2016-2026; ice-out on the flats upstream is typically mid-March.",
  };
  if (validateExperimental(withData).some((i) => i.field === "iceFormationDescription")) {
    fail("an ice answer with data behind it was wrongly flagged");
  }
});

check("experimental: the rent arithmetic the form states is checked", () => {
  const wrong: ExperimentalApplication = {
    ...EXP_BLANK,
    totalAcreage: 3,
    annualLeaseRent: "$100 per year",
  };
  if (!validateExperimental(wrong).some((i) => i.field === "annualLeaseRent")) {
    fail("$100 rent on 3 acres raised no warning; rent is $100 per acre");
  }
  const right: ExperimentalApplication = {
    ...EXP_BLANK,
    totalAcreage: 3,
    annualLeaseRent: "$300 ($100/acre for 3 acres)",
  };
  if (validateExperimental(right).some((i) => i.field === "annualLeaseRent")) {
    fail("a correct rent estimate was wrongly flagged");
  }
});

check("experimental: seeding carries triage over exactly", () => {
  const seeded = seedApplication(EXP, {
    species: ["oysters"],
    gearType: "cages",
    siteAreaSqFt: 3.2 * 43_560,
    leaseDurationYears: 3,
    isFirstTimeApplicant: true,
    wantsToTestBeforeCommitting: true,
    locationDescription: "west of Sears Island",
  }) as ExperimentalApplication;
  if (seeded.totalAcreage !== 3.2) {
    fail(`3.2 acres of square feet seeded as ${seeded.totalAcreage}`);
  }
  if (seeded.leaseTermYears !== 3) fail("the requested term was not carried over");
  if (seeded.generalDescription !== "west of Sears Island") {
    fail("the location description was not carried over");
  }
  // Species and gear are context, not answers: the form's tables want detail
  // triage never asked about, so they must arrive unanswered.
  if (seeded.hatcheryStock !== null || seeded.gearItems !== null) {
    fail("seeding invented stock or gear rows from triage's rough answers");
  }
});

check("experimental: conditional fields follow the branch that rules them out", () => {
  // A generator ruled out hides its nine follow-ups; proposed, they come back.
  const noGenerator: ExperimentalApplication = { ...EXP_BLANK, usesGenerator: false };
  const withGenerator: ExperimentalApplication = { ...EXP_BLANK, usesGenerator: true };
  const visible = (app: ExperimentalApplication) =>
    EXP.fields.filter((f) => fieldApplies(f, app)).length;
  if (visible(withGenerator) <= visible(noGenerator)) {
    fail("proposing a generator did not surface its follow-up questions");
  }
  // The bird-deterrence narrative follows suspended culture, however stated.
  const birdField = EXP.fields.find((f) => f.key === "birdDeterrenceMeasures")!;
  if (fieldApplies(birdField, EXP_BLANK)) {
    fail("bird deterrence is asked before anything suggests suspended culture");
  }
  if (!fieldApplies(birdField, { ...EXP_BLANK, cultureTypes: ["suspended"] })) {
    fail("suspended culture type did not surface the bird-deterrence question");
  }
  if (!fieldApplies(birdField, { ...EXP_BLANK, usesSuspendedGear: true })) {
    fail("suspended gear did not surface the bird-deterrence question");
  }
});

/* -------------------------------------------------------------------------- */
/* Standard lease: two forms, one process                                      */
/* -------------------------------------------------------------------------- */

check("standard: triage opens the draft, and only the draft", () => {
  if (definitionForLicenseType(LicenseType.STANDARD_LEASE)?.id !== "standard_draft") {
    fail("routing to a standard lease should open the draft application");
  }
  if (definitionForLicenseType(LicenseType.EXPERIMENTAL_LEASE)?.id !== "experimental") {
    fail("routing to an experimental lease stopped opening the experimental form");
  }
  if (STANDARD_DRAFT_DEFINITION.successor?.id !== "standard_final") {
    fail("the draft's successor should be the final application");
  }
  if (STANDARD_FINAL_DEFINITION.successor) {
    fail("the final application should have no successor");
  }
  if (!formatCompletion(STANDARD_DRAFT_DEFINITION, { ...EMPTY_STANDARD_DRAFT_APPLICATION }).includes("final application")) {
    fail("a finished draft's completion message never mentions the final application");
  }
});

check("standard: the regulatory caps block, at the cap they don't", () => {
  const over: StandardDraftApplication = {
    ...EMPTY_STANDARD_DRAFT_APPLICATION,
    totalAcreage: 120,
    leaseTermYears: 25,
  };
  const issues = validateStandardDraft(over);
  if (!issues.some((i) => i.field === "totalAcreage" && i.severity === "blocking")) {
    fail("120 acres did not block; the regulatory maximum is 100");
  }
  if (!issues.some((i) => i.field === "leaseTermYears" && i.severity === "blocking")) {
    fail("a 25-year term did not block; the regulatory maximum is 20");
  }
  const at: StandardDraftApplication = {
    ...EMPTY_STANDARD_DRAFT_APPLICATION,
    totalAcreage: 100,
    leaseTermYears: 20,
  };
  if (validateStandardDraft(at).some((i) => i.severity === "blocking")) {
    fail("an application at exactly the caps was blocked");
  }
});

check("standard: advancing carries the shared answers and nothing else", () => {
  const draftDef = STANDARD_DRAFT_DEFINITION;
  const finalDef = STANDARD_FINAL_DEFINITION;

  // A worked draft: shared answers, a draft-only answer, statuses, and meta the
  // new form must not inherit.
  const draft: AnyApplication = {
    ...draftDef.emptyApplication(),
    licenseType: "standard_draft",
    applicantName: "Jane Doe",
    town: "Harpswell",
    totalAcreage: 12,
    leaseTermYears: 15,
    cultureTypes: ["suspended"],
    gearTypesDescription: "floating oyster cages in rows",
    corners: [
      { latitude: 43.65, longitude: -70.18 },
      { latitude: 43.66, longitude: -70.19 },
      { latitude: 43.64, longitude: -70.17 },
    ],
    externalRequirements: { boundary_drawing: "done", application_fee: "done" },
    pendingConcern: "town",
    deferredFields: ["waterbody"],
    stalledOn: "county",
  };

  const advanced = advanceApplication(draftDef, finalDef, draft);

  if (advanced.licenseType !== "standard_final") fail("advancing did not re-tag the draft");
  if (advanced.applicantName !== "Jane Doe" || advanced.town !== "Harpswell") {
    fail("a shared answer did not carry across");
  }
  if (advanced.totalAcreage !== 12 || JSON.stringify(advanced.corners) !== JSON.stringify(draft.corners)) {
    fail("acreage or corners did not carry across");
  }
  if ("gearTypesDescription" in advanced) {
    fail("a draft-only answer leaked into the final application");
  }
  if (advanced.scopingSessionDate !== null || advanced.gearItems !== null) {
    fail("a question only the final form asks did not start unanswered");
  }
  // The fee was paid for the draft; the final application has its own fee, but
  // both catalogs declare the id, so the status carries — the applicant can
  // reset it, and a boundary drawing already made is genuinely made.
  const statuses = advanced.externalRequirements as Record<string, string>;
  if (statuses.boundary_drawing !== "done") {
    fail("a requirement obtained for the draft was not carried");
  }
  if (advanced.pendingConcern !== null || (advanced.deferredFields as string[]).length !== 0 || advanced.stalledOn !== null) {
    fail("draft meta leaked into the new form's interview state");
  }
  const predecessor = advanced.predecessor as Record<string, unknown> | undefined;
  if (!predecessor || predecessor.licenseType !== "standard_draft" || predecessor.gearTypesDescription !== "floating oyster cages in rows") {
    fail("the draft was not kept on record under predecessor");
  }

  // The stash survives storage: migration preserves it along with the tag.
  const reloaded = migrateStoredApplication(advanced);
  if (!reloaded || definitionForApplication(reloaded).id !== "standard_final") {
    fail("an advanced application did not reload as the final form");
    return;
  }
  if (!(reloaded.predecessor as Record<string, unknown>)?.licenseType) {
    fail("the predecessor stash did not survive migration");
  }
  // And the edit path cannot touch it (covered per-form above, asserted here on
  // the pair that actually uses it).
  const meddled = applyEdit(finalDef, reloaded, { type: "field", key: "predecessor", value: {} });
  if (!("error" in meddled)) fail("predecessor was writable as if it were a form field");

  // A value the successor's schema rejects is dropped, not smuggled: feed the
  // carry a corrupted corner list via a hand-built draft.
  const corrupted: AnyApplication = { ...draft, corners: [{ latitude: "off the point" }] };
  const guarded = advanceApplication(draftDef, finalDef, corrupted);
  if (guarded.corners !== null) {
    fail("a value the final form's schema rejects was carried anyway");
  }
});

check("standard: seeding the draft carries triage over exactly", () => {
  const seeded = seedApplication(STANDARD_DRAFT_DEFINITION, {
    species: ["mussels"],
    gearType: "rafts",
    siteAreaSqFt: 12 * 43_560,
    leaseDurationYears: 15,
    isFirstTimeApplicant: false,
    wantsToTestBeforeCommitting: false,
    locationDescription: "east of Butter Island",
  });
  if (seeded.licenseType !== "standard_draft") fail("seeding did not tag the draft");
  if (seeded.totalAcreage !== 12) fail(`12 acres of square feet seeded as ${seeded.totalAcreage}`);
  if (seeded.leaseTermYears !== 15) fail("the requested term was not carried over");
  if (seeded.generalDescription !== "east of Butter Island") {
    fail("the location description was not carried over");
  }
});

console.log(
  failures === 0
    ? "\nEvery field on every form can be shown, saved, read back and migrated."
    : `\n${failures} problem${failures === 1 ? "" : "s"} found.`
);
process.exit(failures === 0 ? 0 : 1);

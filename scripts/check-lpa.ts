/**
 * Deterministic checks over the LPA form: what can be shown, saved, read back,
 * converted, and migrated.
 *
 * Run it with `npm run check`. It needs no database, no API key and no model:
 * it is all pure functions, so it is fast and it can be run after any change to
 * the form's schema, its field list, its editors or its intake.
 *
 * The three files describing a field are written for three different readers and
 * are easy to drift apart. `schema.ts` says what the data is, `fields.ts` says
 * what to ask, `editor.ts` says how to edit it. TypeScript catches a missing
 * editor, because `LPA_EDITORS` is annotated `Record<LpaFormKey, Control>`. It
 * cannot catch the rest: a field with no entry in `LPA_FIELDS` never renders, a
 * dropdown whose options the schema rejects cannot be saved, and a row that
 * arrives pre-answered ships a value nobody chose. Those are what this looks for.
 *
 * When something fails, the message names the field and the reason. Add a check
 * here rather than reasoning about it in the abstract.
 */
import { applyEdit } from "@/lib/application/lpa/edits";
import {
  emptyEntry,
  LPA_EDITORS,
  missingRequiredParts,
  normalizeForSave,
  type Control,
  type RecordPart,
} from "@/lib/application/lpa/editor";
import {
  fieldAnswered,
  fieldApplies,
  LPA_FIELDS,
  LPA_SECTIONS,
  blankUseObservationBoxes,
  rowsMissingDetail,
  speciesAwaitingSource,
} from "@/lib/application/lpa/fields";
import {
  coerceExtracted,
  extractionShapeFor,
  fillMissing,
  formatCompletion,
  nextAsk,
  rejectedObject,
} from "@/lib/application/lpa/interview";
import { applicationProgress, validateApplication } from "@/lib/application/lpa/progress";
import { applicableRequirements } from "@/lib/application/lpa/requirements";
import { parseCoordinate } from "@/lib/application/lpa/coordinates";
import { migrateApplication } from "@/lib/application/lpa/normalize";
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
  type LpaFormKey,
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

const FORM_KEYS = Object.keys(LpaFormSchema.shape) as LpaFormKey[];
const FIELD_KEYS = LPA_FIELDS.map((field) => field.key);
const BLANK: LpaApplication = { ...EMPTY_LPA_APPLICATION };

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

check("every field on the form is reachable on the review screen", () => {
  for (const key of FORM_KEYS) {
    if (!FIELD_KEYS.includes(key)) {
      fail(`${key} has no LPA_FIELDS entry, so the review screen never renders it`);
    }
  }
  for (const key of FIELD_KEYS) {
    if (!FORM_KEYS.includes(key)) fail(`LPA_FIELDS has ${key}, which is not a field on the form`);
  }
  const duplicates = FIELD_KEYS.filter((key, i) => FIELD_KEYS.indexOf(key) !== i);
  if (duplicates.length > 0) fail(`duplicate LPA_FIELDS entries: ${duplicates.join(", ")}`);
  for (const field of LPA_FIELDS) {
    if (!LPA_SECTIONS.some((section) => section.id === field.section)) {
      fail(`${field.key} is filed under an unknown section, ${field.section}`);
    }
  }
});

check("what each control produces, the schema accepts", () => {
  for (const key of FORM_KEYS) {
    const control = LPA_EDITORS[key];
    const value = sampleFor(control);
    const parsed = LpaFormSchema.shape[key].safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      fail(`${key} (${control.kind}) sent ${JSON.stringify(value)} and was rejected: ${issue.message}`);
    }
  }
});

check("every option offered is one the schema accepts", () => {
  for (const key of FORM_KEYS) {
    const control = LPA_EDITORS[key];
    const attempt = (value: unknown, label: string) => {
      const parsed = LpaFormSchema.shape[key].safeParse(value);
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
      if (part.control.kind !== "choice") continue;
      for (const choice of part.control.choices) {
        const row = filledRow(control.parts);
        row[part.key] = choice.value;
        attempt(wrap(control, row), `${key}.${part.key} = "${choice.value}"`);
      }
    }
  }
});

check("a newly added row is unanswered, and cannot be saved until it isn't", () => {
  for (const key of FORM_KEYS) {
    const control = LPA_EDITORS[key];
    if (control.kind !== "record" && control.kind !== "record_list") continue;
    const row = emptyEntry(control.parts);
    const missing = missingRequiredParts(control.parts, row);

    for (const part of control.parts) {
      if (part.required && part.control.kind === "choice" && row[part.key] !== null) {
        fail(`${key}.${part.key} arrives pre-filled with "${String(row[part.key])}" on a new row`);
      }
    }
    // A row the schema rejects with nothing named would enable Save and then fail
    // on the server with a message about the shape rather than about the blank.
    const parsed = LpaFormSchema.shape[key].safeParse(wrap(control, row));
    if (!parsed.success && missing.length === 0) {
      fail(`${key}: a new blank row is rejected but no required part is named, so Save fails`);
    }
  }
});

check("every field can be set, and then cleared", () => {
  for (const key of FORM_KEYS) {
    const set = applyEdit(BLANK, { type: "field", key, value: sampleFor(LPA_EDITORS[key]) });
    if ("error" in set) {
      fail(`${key} could not be set: ${set.error}`);
      continue;
    }
    const cleared = applyEdit(set.application, { type: "field", key, value: null });
    if ("error" in cleared) fail(`${key} could not be cleared: ${cleared.error}`);
    else if ((cleared.application as Record<string, unknown>)[key] !== null) {
      fail(`${key} was not null after clearing`);
    }
  }
  // Yes/no controls have no third state to click, so the Clear button is the only
  // way back to unanswered, and it has to leave the field reading as unanswered.
  for (const field of LPA_FIELDS) {
    if (LPA_EDITORS[field.key].kind !== "boolean") continue;
    const yes = applyEdit(BLANK, { type: "field", key: field.key, value: true });
    if ("error" in yes) continue;
    const cleared = applyEdit(yes.application, { type: "field", key: field.key, value: null });
    if (!("error" in cleared) && fieldAnswered(field, cleared.application)) {
      fail(`${field.key} still reads as answered after being cleared`);
    }
  }
});

check("emptying a list returns the field to unanswered", () => {
  for (const field of LPA_FIELDS) {
    const kind = LPA_EDITORS[field.key].kind;
    if (kind !== "text_list" && kind !== "choice_list" && kind !== "record_list") continue;
    const stored = normalizeForSave([], Boolean(field.emptyListIsAnswer));
    if (field.emptyListIsAnswer) {
      // "None of these" is a real answer the form asks for, so it stays a list.
      if (!Array.isArray(stored)) fail(`${field.key}: "none" should stay an empty list`);
      continue;
    }
    if (stored !== null) fail(`${field.key}: emptying the list stored ${JSON.stringify(stored)}`);
    const saved = applyEdit(BLANK, { type: "field", key: field.key, value: stored });
    if ("error" in saved) fail(`${field.key}: ${saved.error}`);
    else if (fieldAnswered(field, saved.application)) {
      fail(`${field.key}: an emptied list still reads as answered`);
    }
  }
});

check("nothing outside the form can be written through the field path", () => {
  const forbidden = applyEdit(BLANK, { type: "field", key: "externalRequirements", value: {} });
  if (!("error" in forbidden)) fail("externalRequirements was writable as if it were a form field");
  const invented = applyEdit(BLANK, { type: "field", key: "applicantSignature", value: "S.M." });
  if (!("error" in invented)) fail("a field that does not exist was accepted");
  const junk = applyEdit(BLANK, { type: "field", key: "latitude", value: "north a bit" });
  if (!("error" in junk)) fail("latitude accepted text");
});

check("editing the field under query answers the query", () => {
  const queried: LpaApplication = { ...BLANK, pendingConcern: "county" };
  const edited = applyEdit(queried, { type: "field", key: "county", value: "Knox" });
  if ("error" in edited) fail(`editing the queried field failed: ${edited.error}`);
  else if (edited.application.pendingConcern !== null) {
    fail("pendingConcern survived a hand edit to the field it was querying");
  }
});

check("requirement statuses are editable, and only to known values", () => {
  const first = applicableRequirements(BLANK)[0];
  if (!first) {
    fail("no requirements apply to a blank application, so none can be tracked");
    return;
  }
  const done = applyEdit(BLANK, { type: "requirement", id: first.id, status: "done" });
  if ("error" in done) fail(`marking ${first.id} done failed: ${done.error}`);
  const nonsense = applyEdit(BLANK, { type: "requirement", id: first.id, status: "nearly" });
  if (!("error" in nonsense)) fail("an unknown status was accepted");
  const unknown = applyEdit(BLANK, { type: "requirement", id: "no-such-thing", status: "done" });
  if (!("error" in unknown)) fail("an unknown requirement was accepted");
});

check("the counts in the header match the fields on the page", () => {
  const filled = FORM_KEYS.reduce((application, key) => {
    (application as Record<string, unknown>)[key] = sampleFor(LPA_EDITORS[key]);
    return application;
  }, { ...BLANK } as LpaApplication);

  for (const [label, application] of [["a blank draft", BLANK], ["a full draft", filled]] as const) {
    const progress = applicationProgress(application);
    const shown = LPA_FIELDS.filter((field) => fieldApplies(field, application));
    const answered = shown.filter((field) => fieldAnswered(field, application)).length;
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
    for (const issue of validateApplication(application)) {
      if (issue.field && !shown.some((field) => field.key === issue.field)) {
        fail(`${label}: a warning about ${issue.field} is attached to a field the page does not show`);
      }
    }
  }
});

check("the species list covers both of the form's tables", () => {
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

check("naming a species opens the source row the form leaves no choice about", () => {
  // Quahog is hatchery-only, sea scallop is wild-only, blue mussel is on both.
  const named = applyEdit(BLANK, {
    type: "field",
    key: "species",
    value: ["hard_clam_quahog", "sea_scallop", "blue_mussel"],
  });
  if ("error" in named) {
    fail(`naming species failed: ${named.error}`);
    return;
  }
  const app = named.application;
  const hatchery = (app.hatcherySources ?? []).map((row) => row.species);
  const wild = (app.wildSources ?? []).map((row) => row.species);
  if (!hatchery.includes("hard_clam_quahog")) fail("quahog is hatchery-only but opened no hatchery row");
  if (!wild.includes("sea_scallop")) fail("sea scallop is wild-only but opened no wild row");
  if (hatchery.includes("blue_mussel") || wild.includes("blue_mussel")) {
    fail("blue mussel is on both tables and should have been left for the applicant to place");
  }

  // Idempotent: re-saving the same list must not stack a second row.
  const again = applyEdit(app, { type: "field", key: "species", value: app.species });
  if ("error" in again) fail(`re-saving the species list failed: ${again.error}`);
  else if ((again.application.hatcherySources ?? []).length !== (app.hatcherySources ?? []).length) {
    fail("re-saving the same species list opened a duplicate row");
  }

  // A row the applicant deletes stays deleted, even though the species remains.
  const emptied = applyEdit(app, { type: "field", key: "hatcherySources", value: [] });
  if ("error" in emptied) fail(`clearing the hatchery table failed: ${emptied.error}`);
  else if ((emptied.application.hatcherySources ?? []).length !== 0) {
    fail("a deleted source row came back");
  }
});

check("a species with no source keeps a table unanswered, without looping", () => {
  const named = applyEdit(BLANK, { type: "field", key: "species", value: ["blue_mussel"] });
  if ("error" in named) {
    fail(`naming species failed: ${named.error}`);
    return;
  }
  const app = named.application;
  const hatcheryField = LPA_FIELDS.find((f) => f.key === "hatcherySources")!;
  const wildField = LPA_FIELDS.find((f) => f.key === "wildSources")!;

  // A mussel is printed on both tables, and the hatchery table alone carries it.
  if (fieldAnswered(hatcheryField, app)) fail("an unsourced mussel left the hatchery table answered");
  if (!validateApplication(app).some((i) => i.message.includes("no source recorded"))) {
    fail("an unsourced species raised no warning");
  }

  // The property this rule exists for. If the wild table also demanded the
  // mussel, answering "none of it is wild" would change nothing and the same
  // question would come back forever.
  if (!fieldAnswered(wildField, app)) {
    fail("the wild table demands a species the hatchery question already carries, which loops");
  }
  const noneWild = applyEdit(app, { type: "field", key: "wildSources", value: [] });
  if ("error" in noneWild) fail(`recording "nothing from the wild" failed: ${noneWild.error}`);
  else if (!fieldAnswered(wildField, noneWild.application)) {
    fail('answering "nothing from the wild" left the wild table unanswered');
  }

  const sourced = applyEdit(app, {
    type: "field",
    key: "wildSources",
    value: [{ species: "blue_mussel", waterbody: "Casco Bay", healthZone: null, harvesterName: null, harvesterLicenseNumber: null, aquacultureSiteId: null }],
  });
  if ("error" in sourced) {
    fail(`recording a wild source failed: ${sourced.error}`);
    return;
  }
  // Sourced once is sourced. The other table must not go on demanding it.
  if (!fieldAnswered(wildField, sourced.application)) fail("a sourced mussel left the wild table unanswered");
  if (!fieldAnswered(hatcheryField, sourced.application)) {
    fail("a mussel sourced from the wild still leaves the hatchery table demanding it");
  }
  if (validateApplication(sourced.application).some((i) => i.message.includes("no source recorded"))) {
    fail("a sourced species still raised a missing-source warning");
  }
});

check("a source for a species you are not growing is reported", () => {
  const stray = applyEdit(BLANK, {
    type: "field",
    key: "hatcherySources",
    value: [{ species: "bay_scallop", hatcheryName: "Somewhere", hatcheryAddress: null, hatcheryPhone: null }],
  });
  if ("error" in stray) {
    fail(`recording a stray source failed: ${stray.error}`);
    return;
  }
  if (!validateApplication(stray.application).some((i) => i.message.includes("not among the species"))) {
    fail("a source for an unlisted species raised no warning");
  }
});

check("a draft written before the split still opens", () => {
  const legacy = {
    ...BLANK,
    species: undefined,
    hatcheryStock: [
      { species: "eastern_oyster", speciesNote: null, hatcheryName: "Mook Sea Farm", hatcheryAddress: "Walpole", hatcheryPhone: "207" },
      { species: "other", speciesNote: "periwinkles", hatcheryName: null, hatcheryAddress: null, hatcheryPhone: null },
    ],
    wildStock: [{ species: "sea_scallop", speciesNote: null, waterbody: "Casco Bay", healthZone: "3", harvesterName: null, harvesterLicenseNumber: null, aquacultureSiteId: null }],
    somethingTheFormNoLongerHas: "x",
    town: "Harpswell",
  };
  const migrated = migrateApplication(legacy);
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
  if (JSON.stringify(migrateApplication(migrated)) !== JSON.stringify(migrated)) {
    fail("migrating an already-migrated draft changed it");
  }
  if (migrateApplication(null) !== null) fail("a conversation with no application did not migrate to null");
});

check("a coordinate is read however the applicant's plotter shows it", () => {
  // The form wants decimal degrees and says so. A chartplotter, a handheld GPS
  // and the iPhone compass all show degrees, minutes and seconds, and that is
  // what gets typed. Every one of these was an answer the app used to lose.
  const cases: [unknown, "latitude" | "longitude", number | null][] = [
    // Both coordinates in one string, which is how they are given and how the
    // extraction model may well hand them to each field.
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
    // A letter is as good as a sign, and a Maine longitude off a plotter has a
    // W and no sign. Storing +70 would put the site in Mongolia.
    ["70.187833 W", "longitude", -70.187833],
    [`10°30'00"S`, "latitude", -10.5],
    // Unreadable is null, never a guess. A wrongly read coordinate looks
    // answered, is never revisited, and goes out pointing at open water.
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
  // so that validateApplication reports it rather than this silently deciding
  // what the applicant meant.
  const unsigned = parseCoordinate("70.187833", "longitude");
  if (unsigned !== 70.187833) fail("an unsigned longitude should be left for validation to catch");
  const app = { ...BLANK, longitude: unsigned };
  if (!validateApplication(app).some((issue) => issue.field === "longitude")) {
    fail("a positive Maine longitude raised no warning");
  }
});

check("a half-filled source row moves the interview on rather than looping", () => {
  // The state a real conversation got stuck in on 2026-08-19. The applicant gave
  // the hatchery's address and phone but not its name, and said the mussels were
  // wild stock. Extraction did the right thing with all of it. The interview then
  // asked the same question forever, because a row was only a source if one
  // particular column was filled.
  const stuck: LpaApplication = {
    ...BLANK,
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
  // Otherwise the hatchery question goes on demanding a mussel the applicant has
  // already said is wild, and nothing they say can stop it.
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
  if (fieldAnswered(hatcheryField, stuck)) fail("a hatchery row with no hatchery name counts as answered");
  if (fieldAnswered(wildField, stuck)) fail("a wild row with no waterbody counts as answered");

  if (rowsMissingDetail("hatchery", stuck).join() !== "hard_clam_quahog") {
    fail("the quahog's missing hatchery name was not identified");
  }
  const asked = hatcheryField.questionFor?.(stuck) ?? "";
  if (!asked.includes("still need the name")) {
    fail(`the hatchery question should ask for the missing name, got: ${asked.slice(0, 80)}`);
  }
  if (asked === (hatcheryField.questionFor?.(BLANK) ?? hatcheryField.question)) {
    fail("the question did not change once a partial row existed, so it reads as a repeat");
  }

  // What is missing is a validity problem, reported, not a completeness one.
  const messages = validateApplication(stuck).map((issue) => issue.message).join(" ");
  if (!messages.includes("without the hatchery or facility's name")) {
    fail("a source row missing its key column raised no warning");
  }

  // And once the missing columns arrive, both tables are done.
  const complete: LpaApplication = {
    ...stuck,
    hatcherySources: [{ ...stuck.hatcherySources![0], hatcheryName: "Muscongus Bay Aquaculture" }],
    wildSources: stuck.wildSources!.map((row) => ({ ...row, waterbody: "Casco Bay", healthZone: "5" })),
  };
  if (!fieldAnswered(hatcheryField, complete)) fail("a complete hatchery table still reads unanswered");
  if (!fieldAnswered(wildField, complete)) fail("a complete wild table still reads unanswered");
});

check("a question the interview cannot land can be set aside", () => {
  const app: LpaApplication = { ...BLANK, species: ["sugar_kelp"] };
  const stuck = nextAsk(app)?.fields[0].key;
  if (!stuck) {
    fail("a blank application had nothing to ask about");
    return;
  }
  // Set aside, not resolved: the interview stops asking, and everything else
  // still counts it missing, so it stays visible on the review screen and in the
  // progress count rather than quietly becoming someone else's problem.
  const deferred: LpaApplication = { ...app, deferredFields: [stuck] };
  if (nextAsk(deferred)?.fields[0].key === stuck) {
    fail(`${stuck} was asked again after being set aside, which is how the interview loops`);
  }
  const field = LPA_FIELDS.find((f) => f.key === stuck)!;
  if (fieldAnswered(field, deferred)) fail("setting a field aside made it count as answered");
  if (!applicationProgress(deferred).missing.some((f) => f.key === stuck)) {
    fail("a field set aside dropped out of the outstanding list, so it would be lost");
  }
  // And the closing message names them rather than claiming the form is done.
  const allDeferred: LpaApplication = {
    ...app,
    deferredFields: LPA_FIELDS.filter((f) => fieldApplies(f, app)).map((f) => f.key),
  };
  if (nextAsk(allDeferred) !== null) fail("something was still asked with every field set aside");
  if (!formatCompletion(allDeferred).includes("Set aside as we went")) {
    fail("the closing message claims the form is complete when fields were set aside");
  }
});

check('"none observed" is something an applicant can actually say', () => {
  // Told "none" for the existing-uses section, the model returned `false` for
  // four five-part records, which failed the schema and cost the whole turn. It
  // had no better option: the instructions said "none" was a real answer and the
  // shape offered no way to express it. `occurs` is that way.
  const observationField = LPA_FIELDS.find((f) => f.kind === "use_observation")!;
  const blank = { activityTypes: null, seasons: null, frequency: null, occursWithinSite: null, anticipatedImpacts: null };

  const none: LpaApplication = { ...BLANK, [observationField.key]: { occurs: false, ...blank } };
  if (!fieldAnswered(observationField, none)) {
    fail('"none observed" does not count as an answer, so the question repeats forever');
  }
  if (blankUseObservationBoxes(none[observationField.key]).length > 0) {
    fail('"none observed" was reported as having blank boxes, which it should not have to fill');
  }

  const unasked: LpaApplication = { ...BLANK, [observationField.key]: { occurs: null, ...blank } };
  if (fieldAnswered(observationField, unasked)) fail("an untouched observation counts as answered");

  // Partial, in the way extraction is explicitly told to be partial.
  const partial: LpaApplication = {
    ...BLANK,
    [observationField.key]: { ...blank, occurs: true, activityTypes: "lobstering from small boats" },
  };
  if (!fieldAnswered(observationField, partial)) {
    fail("a partly described use counts as no answer, which is how the interview loops");
  }
  if (blankUseObservationBoxes(partial[observationField.key]).length !== 4) {
    fail("the boxes still blank on a partly described use were not reported");
  }
  if (!validateApplication(partial).some((issue) => issue.field === observationField.key)) {
    fail("a partly described use raised no warning");
  }

  // The whole record must still be rejected if it arrives as a bare value, or
  // the review screen would try to render a boolean as five text boxes.
  if (LpaFormSchema.shape[observationField.key].safeParse(false).success) {
    fail("the schema accepts `false` in place of a whole observation record");
  }
});

check("an observation written before `occurs` existed still opens", () => {
  const legacy = {
    ...BLANK,
    commercialFishingUse: {
      activityTypes: "lobstering", seasons: "summer", frequency: "daily",
      occursWithinSite: "no, 200 feet west", anticipatedImpacts: "minimal",
    },
    boatingUse: { activityTypes: null, seasons: null, frequency: null, occursWithinSite: null, anticipatedImpacts: null },
  };
  const migrated = migrateApplication(legacy);
  if (!migrated) {
    fail("a legacy draft migrated to nothing");
    return;
  }
  // Boxes filled in plainly means the use happens; an empty record says nothing.
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
  // `generateObject` throws on any mismatch and carries the parsed object on the
  // error, a couple of `cause` links down. Finding it is what lets the good
  // fields be kept.
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

check("a record answered in part is completed, not thrown away", () => {
  // Every box on these records is nullable, which makes every key *required* in
  // the JSON schema with a null allowed in each. A model that says "there is no
  // commercial fishing here" writes { occurs: false } and stops, having nothing
  // to say about the other five boxes, and the whole field was rejected for the
  // keys it left out. The answer was right; only its completeness was not.
  const partial = fillMissing({ occurs: false }, LpaFormSchema.shape.commercialFishingUse);
  const parsed = LpaFormSchema.shape.commercialFishingUse.safeParse(partial);
  if (!parsed.success) {
    fail(`a record answered in part still does not parse: ${parsed.error.issues[0].message}`);
    return;
  }
  const observationField = LPA_FIELDS.find((f) => f.key === "commercialFishingUse")!;
  if (!fieldAnswered(observationField, { ...BLANK, commercialFishingUse: parsed.data })) {
    fail("a completed partial record still does not count as answered");
  }

  // Filling gaps must never invent an answer: absent means null, which the merge
  // reads as "not mentioned" and asks again.
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

check("the schema accepts the answer the model actually gives", () => {
  // Asked whether there is boating around the site and told there is none, the
  // model returns `false`. Not a record with `occurs` false: just `false`. It did
  // that before `occurs` existed and kept doing it through an instruction telling
  // it not to, which is fair enough, since "no boating happens near my site" is a
  // yes/no answer. The schema now says what the model does, and the conversion
  // happens in code, where it can be read.
  const field = LPA_FIELDS.find((f) => f.key === "boatingUse")!;
  const shape = extractionShapeFor("boatingUse");

  const asNone = shape.safeParse(false);
  if (!asNone.success) {
    fail("the extraction schema still rejects a bare false for a use observation");
    return;
  }
  const none = coerceExtracted("boatingUse", false) as LpaApplication["boatingUse"];
  if (none?.occurs !== false) fail("a bare false did not become an observation saying it does not occur");
  if (!fieldAnswered(field, { ...BLANK, boatingUse: none })) {
    fail("a bare false did not count as an answer, so the question repeats");
  }
  if (!LpaFormSchema.shape.boatingUse.safeParse(none).success) {
    fail("what a bare false converts to is not storable on the form");
  }

  // A partial record has to survive too: a model that says "there is none" has
  // nothing to say about the five boxes underneath.
  if (!shape.safeParse({ occurs: true, activityTypes: "lobster boats" }).success) {
    fail("the extraction schema rejects a partly filled observation");
  }
  const partial = coerceExtracted("boatingUse", {
    occurs: true,
    activityTypes: "lobster boats",
  }) as LpaApplication["boatingUse"];
  if (partial?.seasons !== null) fail("a partly filled observation was not completed with nulls");
  if (partial?.activityTypes !== "lobster boats") fail("completing an observation overwrote what was said");

  // A record saying nothing must read as "not mentioned". The merge writes any
  // non-null value, so an empty record would wipe an answer given earlier.
  if (coerceExtracted("boatingUse", {}) !== null) {
    fail("an empty observation is not treated as silence, so it would overwrite a real answer");
  }
  if (coerceExtracted("boatingUse", null) !== null) fail("null did not stay null");

  // The stored form is unchanged: it still takes the record and nothing else, so
  // the review screen never has to render a boolean as five text boxes.
  if (LpaFormSchema.shape.boatingUse.safeParse(false).success) {
    fail("the stored form accepts a bare false, which the review screen cannot render");
  }
});

console.log(
  failures === 0
    ? "\nEvery field on the form can be shown, saved, read back and migrated."
    : `\n${failures} problem${failures === 1 ? "" : "s"} found.`
);
process.exit(failures === 0 ? 0 : 1);

/**
 * Checks the review screen can actually show, and save, every field on the form.
 *
 * Run it with `npm run check:review`. It needs no database, no API key and no
 * model: it is all pure functions, so it is fast and it can be run after any
 * change to the form's schema, its field list or its editors.
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
} from "@/lib/application/lpa/fields";
import { applicationProgress, validateApplication } from "@/lib/application/lpa/progress";
import { applicableRequirements } from "@/lib/application/lpa/requirements";
import {
  EMPTY_LPA_APPLICATION,
  LpaFormSchema,
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

console.log(
  failures === 0
    ? "\nThe review screen can show and save every field on the form."
    : `\n${failures} problem${failures === 1 ? "" : "s"} found.`
);
process.exit(failures === 0 ? 0 : 1);

/**
 * The application intake interview: keep talking until the form is filled.
 *
 * Where lib/routing/interview.ts answers "which license do you need?", this
 * answers "let's fill that license's application out". It is written against a
 * `LicenseDefinition` rather than any one form: the LPA and the Experimental
 * lease differ in every field and section, and in none of the mechanics.
 *
 * The triage interview extracts four fields, so it can hand the model the whole
 * schema every turn. These forms have sixty to a hundred and fifty, and handing
 * a model that many fields at once produces confident nonsense in the ones it
 * wasn't thinking about. So extraction here is scoped to the section currently
 * being asked about. The applicant is answering a question about, say, gear;
 * only the gear fields are on the table for that turn. That also lets someone
 * volunteer three gear details in one sentence and have all three land.
 *
 * Merging never clears a field. A null coming back from the model means "not
 * mentioned", not "erased" — an important distinction when the model only ever
 * sees one section's worth of context.
 */
import { generateObject } from "ai";
import { z } from "zod";

import { chatModel } from "@/lib/openrouter";
import type { OperationProfile } from "@/lib/routing/schema";

import {
  deferredFieldsOf,
  fieldApplies,
  fieldByKey,
  fieldsInSection,
  sectionById,
  type AnyApplication,
  type FieldDef,
  type LicenseDefinition,
} from "./definition";
import { checkPlausibility } from "./plausibility";
import { applicationProgress, type ValidationIssue } from "./progress";
import { outstandingRequirements } from "./requirements";

/** How many short questions to put in one message. Long ones go out alone. */
const MAX_QUESTIONS_PER_TURN = 3;

/**
 * How many *other* sections one message may revise. Two is generous for real
 * speech ("it's in Belfast, and we're doing mussels as well as oysters") and
 * caps what a confused extraction can cost.
 */
const MAX_REVISED_SECTIONS = 2;

/**
 * A field on the extraction schema that isn't part of the form.
 *
 * People don't answer forms in order. Asked where the site is, someone will
 * happily mention that they're farming mussels as well as oysters, and that
 * belongs to a section seven questions away. Extraction is scoped to one section
 * at a time for accuracy, so without this the mussels are silently dropped and
 * the interview repeats itself, which is maddening.
 *
 * Asking for this alongside the extraction keeps the common case at one model
 * call. A second call happens only when the applicant has actually revised
 * something elsewhere.
 */
const OTHER_SECTIONS_KEY = "otherSectionsMentioned";

/**
 * Where the applicant's wording narrows a fixed-list field to more than one
 * allowed value.
 *
 * "Clams" matches five species on the LPA form. A model asked for one value
 * will pick one, and that is the worst outcome available. A null gets asked
 * again; a plausible wrong value looks answered, is never revisited, and goes
 * out on the form. So ambiguity is reported rather than resolved, and the
 * applicant is asked.
 */
const AMBIGUITIES_KEY = "ambiguousValues";

function isAskedAlone(def: LicenseDefinition, field: FieldDef): boolean {
  return Boolean(def.askedAlone?.has(field.key));
}

function triageContext(profile: OperationProfile): string {
  const known: string[] = [];
  if (profile.species?.length) known.push(`species: ${profile.species.join(", ")}`);
  if (profile.gearType) known.push(`gear or method: ${profile.gearType}`);
  if (profile.siteAreaSqFt) known.push(`approximate site area: ${profile.siteAreaSqFt} sq ft`);
  if (profile.locationDescription) known.push(`location: ${profile.locationDescription}`);
  if (known.length === 0) return "";
  return `\n\nFrom earlier in the conversation, the applicant's operation is described as: ${known.join("; ")}. Use this only where it clearly answers a field; do not invent detail from it.`;
}

/* -------------------------------------------------------------------------- */
/* Choosing what to ask                                                        */
/* -------------------------------------------------------------------------- */

/** A fixed-list field the applicant's wording didn't pin down. */
export interface Ambiguity {
  field: string;
  question: string;
}

export interface ApplicationAsk {
  section: string;
  fields: FieldDef[];
}

/**
 * The next question (or small group of questions) to put to the applicant, or
 * null when every applicable field has an answer. Walks the catalog in form
 * order and groups consecutive short questions from the same section.
 */
export function nextAsk(def: LicenseDefinition, app: AnyApplication): ApplicationAsk | null {
  const deferred = new Set(deferredFieldsOf(app));
  const missing = def.fields.filter(
    (field) =>
      fieldApplies(field, app) && !def.fieldAnswered(field, app) && !deferred.has(field.key)
  );
  const first = missing[0];
  if (!first) return null;

  if (isAskedAlone(def, first)) return { section: first.section, fields: [first] };

  const grouped = [first];
  for (const field of missing.slice(1)) {
    if (grouped.length >= MAX_QUESTIONS_PER_TURN) break;
    if (field.section !== first.section || isAskedAlone(def, field)) break;
    grouped.push(field);
  }
  return { section: first.section, fields: grouped };
}

/* -------------------------------------------------------------------------- */
/* Extraction                                                                  */
/* -------------------------------------------------------------------------- */

/** The shape one field is asked for, which may differ from the shape it stores. */
export function extractionShapeFor(def: LicenseDefinition, key: string): z.ZodTypeAny {
  return def.extractionOverrides?.[key] ?? def.formSchema.shape[key];
}

/** Turns what the model returned for one field into what the form stores. */
export function coerceExtracted(def: LicenseDefinition, key: string, value: unknown): unknown {
  const coerce = def.coercions?.[key];
  return coerce ? coerce(value) : value;
}

/**
 * A Zod object covering just the given fields, built from the full form schema
 * so descriptions and types stay in one place. Built by hand rather than with
 * `.pick()` because the key set is only known at runtime.
 */
function schemaForFields(def: LicenseDefinition, keys: string[]) {
  const sectionIds = def.sections.map((section) => section.id) as [string, ...string[]];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const key of keys) shape[key] = extractionShapeFor(def, key);
  shape[OTHER_SECTIONS_KEY] = z
    .array(z.enum(sectionIds))
    .describe(
      "Sections of the form OTHER than the one named above that this message " +
        "gives new or corrected information about. Usually empty. List a section " +
        "only when the applicant has clearly stated something belonging to it, " +
        "such as naming an extra species while being asked about the location, or " +
        "asking to change an answer they gave earlier."
    );
  shape[AMBIGUITIES_KEY] = z
    .array(
      z.object({
        field: z.string().describe("The key of the field you could not resolve."),
        question: z
          .string()
          .describe(
            "The question to put to the applicant. Ask which they meant in one " +
              "short line, then list the possibilities as markdown bullets using " +
              "their everyday names, one per line. A list is easier to answer " +
              "than five options buried in a sentence."
          ),
      })
    )
    .describe(
      "Fields where what the applicant said matches more than one allowed value " +
        "and they haven't said which. Usually empty."
    );
  return z.object(shape);
}

function extractionInstructions(def: LicenseDefinition): string {
  return `You are filling in ${def.formTitle} from a conversation with the applicant.

You are given the fields in one section of the form, their current values, and \
the applicant's latest message. Return that same set of fields:

- Set a field when the applicant's message answers it, including indirectly.
- Carry forward the current value when the message doesn't touch that field.
- Leave a field null if it has never been answered.
- Never invent a value. A plausible guess is worse than a null here: this is a \
legal application and an inaccurate answer can get it denied and the fee forfeited.
- Fields with a fixed list of allowed values come with a definition of each value. \
Map what the applicant said onto the closest one using those definitions. That is \
not guessing, it is the whole point of the list, so only leave such a field null \
when they haven't addressed the question at all.
- "None", "no", "not applicable" are real answers. Record them as an empty list \
for a list field, or false for a yes/no field, rather than leaving null. For a \
field that is a record of several parts, use the part that asks whether the thing \
happens at all, and leave the other parts null. Each field's own description says \
what it will accept; follow that description rather than guessing at a shape.
- When a fixed list is involved and the applicant's wording fits more than one \
allowed value, do NOT choose for them. Leave the value out and add an entry to \
"${AMBIGUITIES_KEY}" with a question naming the options. Guessing between allowed \
values is the most damaging thing you can do here: a wrong value looks answered, \
is never asked about again, and goes out on the application. An unanswered field \
gets asked again, which costs nothing.
- For a list of records, record the part you were told and leave the rest of that \
record's fields null. Someone naming a species without naming its hatchery has \
still told you the species, and it must be recorded. A partial record is right; \
dropping it because it isn't finished is wrong. Keep records already in the list \
and add to them.
- Where the applicant gives a number with units, record just the number.

Do not ask questions; you are only recording answers.

People don't fill forms in order. Asked where their site is, someone will mention \
that they're farming mussels as well as oysters, or ask to correct an email they \
gave ten questions ago. You cannot record those yourself, because you only have \
this section's fields. Instead, list the sections they belong to in \
"${OTHER_SECTIONS_KEY}" and they will be handled separately.

The sections of the form are:

${def.sections.map((section) => `- ${section.id}: ${section.title}. ${section.blurb}`).join("\n")}

Leave "${OTHER_SECTIONS_KEY}" as an empty list when the message only concerns the \
section you were given, which is the usual case. Never list the section you were \
given. List a section only when the applicant has actually stated something that \
belongs to it, not merely alluded to it.`;
}

/**
 * The object the model returned, dug out of a validation failure.
 *
 * `generateObject` throws when the output doesn't match, and the parsed object is
 * carried on the error rather than returned. It sits a couple of `cause` links
 * down, so this walks the chain instead of reaching for a fixed path.
 */
export function rejectedObject(error: unknown): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  let node: unknown = error;
  while (node && typeof node === "object" && !seen.has(node)) {
    seen.add(node);
    const value = (node as { value?: unknown }).value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    node = (node as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Steps past `.nullable()` and `.optional()` to the schema underneath.
 *
 * Only those wrappers, chosen by name. `unwrap()` is not the "take the wrapper
 * off" method it looks like: `ZodArray` has one too, and it returns the *element*
 * type, so calling it blindly walks straight through a list into the shape of one
 * of its rows. That silently turned the gap-filling below into a no-op for every
 * list on the form.
 */
const WRAPPERS = new Set(["nullable", "optional", "default", "readonly"]);

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let node = schema;
  // Bounded rather than `while (true)`: a malformed schema must not hang a turn.
  for (let depth = 0; depth < 10; depth += 1) {
    const type = (node as { def?: { type?: string } }).def?.type;
    if (!type || !WRAPPERS.has(type)) break;
    const inner = (node as { unwrap?: () => z.ZodTypeAny }).unwrap?.();
    if (!inner || inner === node) break;
    node = inner;
  }
  return node;
}

/**
 * Writes null into every key the schema expects and the model left out.
 *
 * The form's records are all-nullable objects, which makes every key *required*
 * in the JSON schema with a null allowed in each. A model answering "there is no
 * commercial fishing here" writes `{"occurs": false}` and stops, because it has
 * nothing to say about the other five boxes, and that is rejected for missing
 * keys. The answer was right; only its completeness was not.
 *
 * Absent and null already mean the same thing to the merge, which skips both as
 * "not mentioned". So filling the gaps is not a guess about what the applicant
 * said. It writes down the reading the rest of this file already takes.
 */
export function fillMissing(value: unknown, schema: z.ZodTypeAny): unknown {
  const inner = unwrapSchema(schema);

  const shape = (inner as { shape?: Record<string, z.ZodTypeAny> }).shape;
  if (shape && value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const filled: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(shape)) {
      filled[key] = key in record ? fillMissing(record[key], field) : null;
    }
    return filled;
  }

  const element = (inner as { element?: z.ZodTypeAny }).element;
  if (element && Array.isArray(value)) return value.map((item) => fillMissing(item, element));

  return value;
}

/**
 * Extraction that survives the model getting one field's shape wrong.
 *
 * `generateObject` validates the whole object and throws if any part of it
 * fails, so a single malformed field discarded everything the applicant had just
 * said. That happened: told "none" for the existing-uses section, the model
 * returned `false` for four five-part records, and the turn was lost along with
 * the two fields it had got right.
 *
 * The strict schema is still what the model is asked for, because it is what
 * guides the output. What changes is the handling of a rejection: each field is
 * re-validated on its own and the ones that parse are kept. A bad field now costs
 * that field, which gets asked again, rather than the turn.
 *
 * If nothing at all can be salvaged the error is rethrown, because at that point
 * the applicant genuinely needs to be told.
 */
export interface Salvage {
  /** Exactly what the model sent, before any repair. */
  rejected: unknown;
  /** Fields that still would not parse, and so were dropped. */
  dropped: string[];
}

async function generateExtraction(
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  keys: string[],
  options: Parameters<typeof generateObject>[0]
): Promise<{ object: Record<string, unknown>; salvage: Salvage | null }> {
  try {
    const { object } = await generateObject(options);
    return { object: object as Record<string, unknown>, salvage: null };
  } catch (error) {
    const returned = rejectedObject(error);
    if (!returned) throw error;

    const repaired = fillMissing(returned, schema) as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, field] of Object.entries(schema.shape)) {
      const parsed = field.safeParse(repaired[key]);
      if (parsed.success) kept[key] = parsed.data;
      else if (keys.includes(key)) dropped.push(key);
    }
    if (Object.keys(kept).length === 0) throw error;

    if (dropped.length > 0) {
      console.warn(`[extraction] dropped fields the model got wrong: ${dropped.join(", ")}`);
    }
    return { object: kept, salvage: { rejected: returned, dropped } };
  }
}

/**
 * Runs one extraction pass over the section being discussed. Returns the merged
 * application — values already present survive unless the model supplies a new
 * one.
 */
async function extractSection(
  def: LicenseDefinition,
  app: AnyApplication,
  section: string,
  userMessage: string,
  profile: OperationProfile
): Promise<{
  merged: AnyApplication;
  changed: string[];
  alsoMentions: string[];
  ambiguities: Ambiguity[];
}> {
  const sectionIds = new Set(def.sections.map((s) => s.id));
  const keys = fieldsInSection(def, section)
    .filter((field) => fieldApplies(field, app))
    .map((field) => field.key);
  if (keys.length === 0) return { merged: app, changed: [], alsoMentions: [], ambiguities: [] };

  const current = Object.fromEntries(keys.map((key) => [key, app[key]]));

  const schema = schemaForFields(def, keys);
  const { object, salvage } = await generateExtraction(schema, keys, {
    model: chatModel,
    schema,
    instructions: extractionInstructions(def),
    prompt:
      `Section of the form: ${sectionById(def, section).title}\n\n` +
      `Current values (JSON): ${JSON.stringify(current)}\n\n` +
      `Applicant's latest message: ${userMessage}` +
      triageContext(profile),
  });

  const extracted = object as Record<string, unknown>;

  // Set DEBUG_EXTRACTION=1 in .env.local to record what the model was asked for
  // and what it gave back. Written to debug-extraction.log in the project root
  // rather than the console, so it can be read after the fact instead of being
  // hunted for in a scrolling terminal.
  if (process.env.DEBUG_EXTRACTION) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      "debug-extraction.log",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          form: def.id,
          section,
          fieldsOffered: keys,
          userMessage,
          returned: extracted,
          // What the model actually sent, when that needed repairing. Without
          // this the log showed a field simply absent, with no way to tell
          // whether the model had skipped it or got its shape wrong.
          rejectedBySchema: salvage?.rejected,
          droppedAfterRepair: salvage?.dropped,
          jsonSchemaSent: z.toJSONSchema(schema),
        },
        null,
        2
      ) + "\n\n"
    );
    console.log(`[extraction] ${def.id}/${section}: wrote to debug-extraction.log`);
  }

  const merged: AnyApplication = { ...app };
  const changed: string[] = [];
  for (const key of keys) {
    const value = coerceExtracted(def, key, extracted[key]);
    // Null means "not mentioned", not "clear this field". The model only saw
    // one section and one message, so it is never authoritative about absence.
    // A coercion that failed also lands here, so an unreadable coordinate is
    // asked again rather than stored as something it isn't.
    if (value === null || value === undefined) continue;
    if (JSON.stringify(value) !== JSON.stringify(app[key])) changed.push(key);
    merged[key] = value;
  }

  // The meta field isn't in `keys`, so the merge loop above ignores it and it
  // never reaches the stored application.
  const mentioned = extracted[OTHER_SECTIONS_KEY];
  const alsoMentions = Array.isArray(mentioned)
    ? (mentioned.filter(
        (id) => typeof id === "string" && id !== section && sectionIds.has(id)
      ) as string[])
    : [];

  const raw = extracted[AMBIGUITIES_KEY];
  const ambiguities: Ambiguity[] = Array.isArray(raw)
    ? raw
        .map((entry) => entry as { field?: unknown; question?: unknown })
        // An ambiguity about a field we didn't ask for, or with no question to
        // put, would stall the interview on something unanswerable.
        .map((entry) => ({
          // The model may name a path into a record, "hatcheryStock.species",
          // rather than the field itself. That's a reasonable way to point at
          // the ambiguous thing, and dropping it silently loses a real report,
          // so only the root is used.
          field: typeof entry?.field === "string" ? entry.field.split(".")[0] : "",
          question: typeof entry?.question === "string" ? entry.question.trim() : "",
        }))
        .filter((entry) => entry.question !== "" && keys.includes(entry.field))
    : [];

  // The form's own reaction to the merge — the LPA opens the source row a newly
  // named species needs — runs after `changed` is taken, deliberately: an opened
  // row is the app's own doing, and flagging it as changed would put it in front
  // of the plausibility check to be argued about.
  const settled = def.afterMerge ? def.afterMerge(app, merged) : merged;
  return { merged: settled, changed, alsoMentions, ambiguities };
}

/**
 * Records information the applicant volunteered about sections other than the
 * one they were asked about. Runs the same extraction against each, threading
 * the result through so two revisions in one sentence both land.
 */
async function applyRevisions(
  def: LicenseDefinition,
  app: AnyApplication,
  sections: string[],
  userMessage: string,
  profile: OperationProfile
): Promise<{ merged: AnyApplication; changed: string[]; ambiguities: Ambiguity[] }> {
  let working = app;
  const changed: string[] = [];
  const ambiguities: Ambiguity[] = [];
  for (const section of [...new Set(sections)].slice(0, MAX_REVISED_SECTIONS)) {
    const result = await extractSection(def, working, section, userMessage, profile);
    working = result.merged;
    changed.push(...result.changed);
    ambiguities.push(...result.ambiguities);
  }
  return { merged: working, changed, ambiguities };
}

/* -------------------------------------------------------------------------- */
/* Message formatting                                                          */
/* -------------------------------------------------------------------------- */

function formatAsk(
  def: LicenseDefinition,
  app: AnyApplication,
  ask: ApplicationAsk,
  includeSectionHeader: boolean
): string {
  const wording = (field: FieldDef) => field.questionFor?.(app) ?? field.question;
  const section = sectionById(def, ask.section);
  const lines: string[] = [];

  if (includeSectionHeader) {
    lines.push(`**${section.title}.** ${section.blurb}`, "");
  }

  if (ask.fields.length === 1) {
    const [field] = ask.fields;
    lines.push(wording(field));
    if (field.hint) lines.push("", `*${field.hint}*`);
    return lines.join("\n");
  }

  for (const field of ask.fields) {
    lines.push(`- ${wording(field)}`);
  }
  // A blank line between each: consecutive lines collapse into one paragraph in
  // markdown, which ran all three hints together into a wall of text.
  for (const field of ask.fields.filter((f) => f.hint)) {
    lines.push("", `*${field.label}: ${field.hint}*`);
  }
  return lines.join("\n");
}

function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => `${issue.severity === "blocking" ? "🛑" : "⚠️"} ${issue.message}`)
    .join("\n\n");
}

/**
 * The question currently on the table, without its section header. Used when
 * the applicant breaks off to ask something and needs bringing back.
 */
export function pendingQuestionText(def: LicenseDefinition, app: AnyApplication): string | null {
  const ask = nextAsk(def, app);
  return ask ? formatAsk(def, app, ask, false) : null;
}

/** What to say once every question has an answer. */
export function formatCompletion(def: LicenseDefinition, app: AnyApplication): string {
  const outstanding = outstandingRequirements(def, app);
  const deferred = new Set(deferredFieldsOf(app));
  const setAside = def.fields.filter(
    (field) => deferred.has(field.key) && fieldApplies(field, app)
  );

  const lines = [
    setAside.length === 0
      ? `That's every question on the ${def.shortName} form answered. ` +
        "You can review the whole application and correct anything that's off."
      : "That's as far as I can get by asking. You can review the whole " +
        "application and correct anything that's off.",
  ];

  // Named rather than quietly left blank. The interview stopped asking about
  // these; the form still wants them.
  if (setAside.length > 0) {
    lines.push(
      "",
      "**Set aside as we went.** I couldn't get an answer to these, so they're " +
        "still blank. You can fill them in on the Application tab, or tell me now:",
      "",
      ...setAside.map((field) => `- **${field.label}.** ${field.question}`)
    );
  }

  if (outstanding.length > 0) {
    lines.push(
      "",
      "**Still needed from you.** These are the parts I can't produce:",
      "",
      ...outstanding.map((req) => `- **${req.label}.** ${req.detail}`)
    );
  }

  const issues = def.validate(app);
  if (issues.length > 0) {
    lines.push("", "**Worth a second look before you submit:**", "", formatIssues(issues));
  }

  lines.push(
    "",
    "This is a draft prepared from what you've told me, not legal advice. " +
      "Check it against the current form and DMR's guidance before you send it."
  );
  return lines.join("\n");
}

/** The handoff message shown when triage lands on a license and intake begins. */
export function formatIntakeIntro(def: LicenseDefinition, app: AnyApplication): string {
  const progress = applicationProgress(def, app);
  const ask = nextAsk(def, app);
  const lines = [
    `Let's fill out the ${def.shortName}. There are ${progress.applicable} questions on the form ` +
      "as it applies to your site, and some of them will drop away as we go depending on your answers. " +
      "You can stop and ask me a regulatory question at any point, and we'll pick up where we left off.",
    "",
  ];
  if (ask) lines.push(formatAsk(def, app, ask, true));
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* One turn                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApplicationTurn {
  application: AnyApplication;
  reply: string;
}

/**
 * Processes one applicant message against the draft application: records answers
 * for the section under discussion, checks what changed for factual mistakes,
 * then either raises a concern or moves on to the next gap.
 *
 * A raised concern takes over the turn. Asking "did you mean Cumberland?" and
 * the next form question in the same breath gives the applicant two things to
 * answer and gets a reply to neither.
 */
export async function runApplicationTurn(
  def: LicenseDefinition,
  app: AnyApplication,
  userMessage: string,
  profile: OperationProfile
): Promise<ApplicationTurn> {
  // If the last turn queried one of their answers, this reply belongs to that
  // field's section, not to wherever the interview had already moved on to.
  const queried =
    typeof app.pendingConcern === "string" ? fieldByKey(def, app.pendingConcern) : undefined;
  const askBefore = nextAsk(def, app);
  const focusSection = queried?.section ?? askBefore?.section;

  if (!focusSection) {
    // Nothing left to collect; a stray message here shouldn't overwrite
    // anything, so just restate where things stand.
    return { application: app, reply: formatCompletion(def, app) };
  }

  const issuesBefore = new Set(def.validate(app).map((issue) => issue.message));
  const extraction = await extractSection(def, app, focusSection, userMessage, profile);

  // Anything they volunteered about other parts of the form gets recorded too,
  // so a person can correct an earlier answer whenever they think of it rather
  // than only when the interview happens to be pointed at that field.
  const revision = await applyRevisions(
    def,
    extraction.merged,
    extraction.alsoMentions,
    userMessage,
    profile
  );

  // Clear the outstanding concern whatever they said. If they stood by their
  // answer nothing changed, so nothing will be raised again and they aren't
  // argued with twice. If they corrected it, the new value is checked afresh.
  const updated: AnyApplication = { ...revision.merged, pendingConcern: null };
  const changed = [...extraction.changed, ...revision.changed];

  const parts: string[] = [];
  const newIssues = def.validate(updated).filter((issue) => !issuesBefore.has(issue.message));
  if (newIssues.length > 0) parts.push(formatIssues(newIssues));

  // Say what was changed elsewhere. Silently editing a field they aren't
  // looking at would leave them unsure whether it registered.
  const ambiguities = [...extraction.ambiguities, ...revision.ambiguities];
  const unresolved = new Set(ambiguities.map((item) => item.field));

  // A field we're about to say we couldn't resolve must not also be announced as
  // updated. Carrying an existing entry forward counts as a change, so "clams"
  // could produce "Updated hatchery-sourced species" immediately before asking
  // which clam, which reads as though the answer landed.
  const revisedLabels = [
    ...new Set(
      revision.changed
        .filter((key) => !unresolved.has(key))
        .map((key) => fieldByKey(def, key)?.label)
        .filter((label): label is string => Boolean(label))
    ),
  ];
  if (revisedLabels.length > 0) {
    parts.push(`Updated ${revisedLabels.join(", ").toLowerCase()}.`);
  }

  // An unresolved value is asked about before anything else, and before paying
  // for a plausibility call. It concerns the message they just sent, and pairing
  // it with another question would get an answer to neither.
  const [ambiguity] = ambiguities;
  if (ambiguity) {
    parts.push(ambiguity.question);
    return {
      application: { ...updated, pendingConcern: ambiguity.field },
      reply: parts.join("\n\n"),
    };
  }

  const [concern] = await checkPlausibility(def, updated, changed);
  if (concern) {
    parts.push(`${concern.concern} ${concern.question}`);
    return {
      application: { ...updated, pendingConcern: concern.field },
      reply: parts.join("\n\n"),
    };
  }

  const askAfter = nextAsk(def, updated);
  if (!askAfter) {
    parts.push(formatCompletion(def, updated));
    return { application: updated, reply: parts.join("\n\n") };
  }

  const madeProgress = !askBefore || askAfter.fields[0].key !== askBefore.fields[0].key;
  // Only treat a turn as empty when it genuinely produced nothing. Partially
  // answering a question (a species without its hatchery) leaves the same
  // question outstanding, but something was recorded and saying otherwise reads
  // as the app ignoring them.
  const producedNothing = !madeProgress && !queried && changed.length === 0;
  const stuckField = askAfter.fields[0].key;

  if (producedNothing && updated.stalledOn === stuckField) {
    // Asked twice, nothing either time. Asking a third time is how an interview
    // becomes a loop the applicant cannot get out of, so the field is set aside
    // and the form moves on. It stays missing everywhere that counts.
    const setAside: AnyApplication = {
      ...updated,
      deferredFields: [...new Set([...deferredFieldsOf(updated), stuckField])],
      stalledOn: null,
    };
    const label = fieldByKey(def, stuckField)?.label?.toLowerCase() ?? "that";
    parts.push(
      `I'm not getting anywhere with ${label}, so let's leave it and come back. ` +
        "You can fill it in on the Application tab whenever you like, or just tell me later."
    );

    const askNext = nextAsk(def, setAside);
    if (!askNext) {
      parts.push(formatCompletion(def, setAside));
      return { application: setAside, reply: parts.join("\n\n") };
    }
    parts.push(formatAsk(def, setAside, askNext, askNext.section !== askAfter.section));
    return { application: setAside, reply: parts.join("\n\n") };
  }

  const carried: AnyApplication = { ...updated, stalledOn: producedNothing ? stuckField : null };
  if (producedNothing) {
    parts.push("Sorry, I didn't catch an answer to that one. Let me try again.");
  }

  parts.push(
    formatAsk(def, carried, askAfter, madeProgress && askAfter.section !== askBefore?.section)
  );
  return { application: carried, reply: parts.join("\n\n") };
}

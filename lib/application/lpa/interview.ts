/**
 * The application intake interview: keep talking until the LPA form is filled.
 *
 * Where lib/routing/interview.ts answers "which license do you need?", this
 * answers "let's fill that license's application out". The two are deliberately
 * similar in shape — extract from the latest message, merge into what's known,
 * ask for the next gap — but they differ in one important way.
 *
 * The triage interview extracts four fields, so it can hand the model the whole
 * schema every turn. The LPA form has around sixty, and handing a model sixty
 * fields at once produces confident nonsense in the ones it wasn't thinking
 * about. So extraction here is scoped to the section currently being asked
 * about. The applicant is answering a question about, say, gear; only the gear
 * fields are on the table for that turn. That also lets someone volunteer three
 * gear details in one sentence and have all three land.
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
  fieldAnswered,
  fieldApplies,
  fieldByKey,
  fieldsInSection,
  LPA_FIELDS,
  LPA_SECTIONS,
  sectionById,
  type LpaFieldDef,
  type SectionId,
} from "./fields";
import { checkPlausibility } from "./plausibility";
import { applicationProgress, validateApplication, type ValidationIssue } from "./progress";
import { outstandingRequirements } from "./requirements";
import {
  EMPTY_LPA_APPLICATION,
  LpaFormSchema,
  type LpaApplication,
  type LpaForm,
  type LpaFormKey,
} from "./schema";

/** How many short questions to put in one message. Long ones go out alone. */
const MAX_QUESTIONS_PER_TURN = 3;

/**
 * How many *other* sections one message may revise. Two is generous for real
 * speech ("it's in Belfast, and we're doing mussels as well as oysters") and
 * caps what a confused extraction can cost.
 */
const MAX_REVISED_SECTIONS = 2;

const SECTION_IDS = LPA_SECTIONS.map((section) => section.id) as [SectionId, ...SectionId[]];

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
 * "Clams" matches five species on the form: hard clam, soft-shelled, Atlantic
 * surf, Arctic surf and razor. A model asked for one value will pick one, and
 * that is the worst outcome available. A null gets asked again; a plausible
 * wrong value looks answered, is never revisited, and goes out on the form. So
 * ambiguity is reported rather than resolved, and the applicant is asked.
 */
const AMBIGUITIES_KEY = "ambiguousValues";

/**
 * Fields that ask for a table or a multi-part narrative. Bundling one of these
 * with other questions produces a wall of text nobody answers completely.
 */
const ASKED_ALONE: ReadonlySet<LpaFormKey> = new Set<LpaFormKey>([
  "hatcheryStock",
  "wildStock",
  "gearItems",
  "gearCategories",
  "nearbyFeatures",
  "riparianLandowners",
  "birdDeterrenceMeasures",
  "mooringDescription",
  "lpaHealthZone",
]);

function isAskedAlone(field: LpaFieldDef): boolean {
  return field.kind === "use_observation" || ASKED_ALONE.has(field.key);
}

/* -------------------------------------------------------------------------- */
/* Seeding from triage                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Carries what triage already learned into a blank application. Only
 * `locationDescription` maps cleanly onto a form field; species and gear are
 * passed to the extraction model as context instead (see `triageContext`),
 * because the form wants them broken down in ways triage never asked about —
 * which hatchery, which gear category, how many units.
 */
export function seedApplication(profile: OperationProfile): LpaApplication {
  return {
    ...EMPTY_LPA_APPLICATION,
    siteDescription: profile.locationDescription,
  };
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
  field: LpaFormKey;
  question: string;
}

export interface ApplicationAsk {
  section: SectionId;
  fields: LpaFieldDef[];
}

/**
 * The next question (or small group of questions) to put to the applicant, or
 * null when every applicable field has an answer. Walks the catalog in form
 * order and groups consecutive short questions from the same section.
 */
export function nextAsk(app: LpaApplication): ApplicationAsk | null {
  const missing = LPA_FIELDS.filter((field) => fieldApplies(field, app) && !fieldAnswered(field, app));
  const first = missing[0];
  if (!first) return null;

  if (isAskedAlone(first)) return { section: first.section, fields: [first] };

  const grouped = [first];
  for (const field of missing.slice(1)) {
    if (grouped.length >= MAX_QUESTIONS_PER_TURN) break;
    if (field.section !== first.section || isAskedAlone(field)) break;
    grouped.push(field);
  }
  return { section: first.section, fields: grouped };
}

/* -------------------------------------------------------------------------- */
/* Extraction                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A Zod object covering just the given fields, built from the full form schema
 * so descriptions and types stay in one place. Built by hand rather than with
 * `.pick()` because the key set is only known at runtime.
 */
function schemaForFields(keys: LpaFormKey[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const key of keys) shape[key] = LpaFormSchema.shape[key];
  shape[OTHER_SECTIONS_KEY] = z
    .array(z.enum(SECTION_IDS))
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

const EXTRACTION_INSTRUCTIONS = `You are filling in Maine DMR's Limited Purpose \
Aquaculture (LPA) license application from a conversation with the applicant.

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
for a list field, or false for a yes/no field, rather than leaving null.
- When a fixed list is involved and the applicant's wording fits more than one \
allowed value, do NOT choose for them. Leave the value out and add an entry to \
"${AMBIGUITIES_KEY}" with a question naming the options. Someone saying "clams" \
could mean any of five species on this form. Guessing between allowed values is \
the most damaging thing you can do here: a wrong value looks answered, is never \
asked about again, and goes out on the application. An unanswered field gets \
asked again, which costs nothing.
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

${LPA_SECTIONS.map((section) => `- ${section.id}: ${section.title}. ${section.blurb}`).join("\n")}

Leave "${OTHER_SECTIONS_KEY}" as an empty list when the message only concerns the \
section you were given, which is the usual case. Never list the section you were \
given. List a section only when the applicant has actually stated something that \
belongs to it, not merely alluded to it.`;

/**
 * Runs one extraction pass over the section being discussed. Returns the merged
 * application — values already present survive unless the model supplies a new
 * one.
 */
async function extractSection(
  app: LpaApplication,
  section: SectionId,
  userMessage: string,
  profile: OperationProfile
): Promise<{
  merged: LpaApplication;
  changed: LpaFormKey[];
  alsoMentions: SectionId[];
  ambiguities: Ambiguity[];
}> {
  const keys = fieldsInSection(section)
    .filter((field) => fieldApplies(field, app))
    .map((field) => field.key);
  if (keys.length === 0) return { merged: app, changed: [], alsoMentions: [], ambiguities: [] };

  const current = Object.fromEntries(keys.map((key) => [key, app[key]]));

  const schema = schemaForFields(keys);
  const { object } = await generateObject({
    model: chatModel,
    schema,
    instructions: EXTRACTION_INSTRUCTIONS,
    prompt:
      `Section of the form: ${sectionById(section).title}\n\n` +
      `Current values (JSON): ${JSON.stringify(current)}\n\n` +
      `Applicant's latest message: ${userMessage}` +
      triageContext(profile),
  });

  const extracted = object as Partial<LpaForm>;

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
          section,
          fieldsOffered: keys,
          userMessage,
          returned: extracted,
          jsonSchemaSent: z.toJSONSchema(schema),
        },
        null,
        2
      ) + "\n\n"
    );
    console.log(`[extraction] ${section}: wrote to debug-extraction.log`);
  }

  const merged: LpaApplication = { ...app };
  const changed: LpaFormKey[] = [];
  for (const key of keys) {
    const value = extracted[key];
    // Null means "not mentioned", not "clear this field". The model only saw
    // one section and one message, so it is never authoritative about absence.
    if (value === null || value === undefined) continue;
    if (JSON.stringify(value) !== JSON.stringify(app[key])) changed.push(key);
    (merged as Record<string, unknown>)[key] = value;
  }

  // The meta field isn't in `keys`, so the merge loop above ignores it and it
  // never reaches the stored application.
  const mentioned = (extracted as Record<string, unknown>)[OTHER_SECTIONS_KEY];
  const alsoMentions = Array.isArray(mentioned)
    ? (mentioned.filter(
        (id) => typeof id === "string" && id !== section && SECTION_IDS.includes(id as SectionId)
      ) as SectionId[])
    : [];

  const raw = (extracted as Record<string, unknown>)[AMBIGUITIES_KEY];
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
          field: (typeof entry?.field === "string" ? entry.field.split(".")[0] : "") as LpaFormKey,
          question: typeof entry?.question === "string" ? entry.question.trim() : "",
        }))
        .filter((entry) => entry.question !== "" && keys.includes(entry.field))
    : [];

  return { merged, changed, alsoMentions, ambiguities };
}

/**
 * Records information the applicant volunteered about sections other than the
 * one they were asked about. Runs the same extraction against each, threading
 * the result through so two revisions in one sentence both land.
 */
async function applyRevisions(
  app: LpaApplication,
  sections: SectionId[],
  userMessage: string,
  profile: OperationProfile
): Promise<{ merged: LpaApplication; changed: LpaFormKey[]; ambiguities: Ambiguity[] }> {
  let working = app;
  const changed: LpaFormKey[] = [];
  const ambiguities: Ambiguity[] = [];
  for (const section of [...new Set(sections)].slice(0, MAX_REVISED_SECTIONS)) {
    const result = await extractSection(working, section, userMessage, profile);
    working = result.merged;
    changed.push(...result.changed);
    ambiguities.push(...result.ambiguities);
  }
  return { merged: working, changed, ambiguities };
}

/* -------------------------------------------------------------------------- */
/* Message formatting                                                          */
/* -------------------------------------------------------------------------- */

function formatAsk(ask: ApplicationAsk, includeSectionHeader: boolean): string {
  const section = sectionById(ask.section);
  const lines: string[] = [];

  if (includeSectionHeader) {
    lines.push(`**${section.title}.** ${section.blurb}`, "");
  }

  if (ask.fields.length === 1) {
    const [field] = ask.fields;
    lines.push(field.question);
    if (field.hint) lines.push("", `*${field.hint}*`);
    return lines.join("\n");
  }

  for (const field of ask.fields) {
    lines.push(`- ${field.question}`);
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
export function pendingQuestionText(app: LpaApplication): string | null {
  const ask = nextAsk(app);
  return ask ? formatAsk(ask, false) : null;
}

/** What to say once every question has an answer. */
export function formatCompletion(app: LpaApplication): string {
  const outstanding = outstandingRequirements(app);
  const lines = [
    "That's every question on the LPA application form answered. " +
      "You can review the whole application and correct anything that's off.",
  ];

  if (outstanding.length > 0) {
    lines.push(
      "",
      "**Still needed from you.** These are the parts I can't produce:",
      "",
      ...outstanding.map((req) => `- **${req.label}.** ${req.detail}`)
    );
  }

  const issues = validateApplication(app);
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

/** The handoff message shown when triage lands on LPA and intake begins. */
export function formatIntakeIntro(app: LpaApplication): string {
  const progress = applicationProgress(app);
  const ask = nextAsk(app);
  const lines = [
    `Let's fill out the LPA application. There are ${progress.applicable} questions on the form ` +
      "as it applies to your site, and some of them will drop away as we go depending on your answers. " +
      "You can stop and ask me a regulatory question at any point, and we'll pick up where we left off.",
    "",
  ];
  if (ask) lines.push(formatAsk(ask, true));
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* One turn                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApplicationTurn {
  application: LpaApplication;
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
  app: LpaApplication,
  userMessage: string,
  profile: OperationProfile
): Promise<ApplicationTurn> {
  // If the last turn queried one of their answers, this reply belongs to that
  // field's section, not to wherever the interview had already moved on to.
  const queried = app.pendingConcern
    ? fieldByKey(app.pendingConcern as LpaFormKey)
    : undefined;
  const askBefore = nextAsk(app);
  const focusSection = queried?.section ?? askBefore?.section;

  if (!focusSection) {
    // Nothing left to collect; a stray message here shouldn't overwrite
    // anything, so just restate where things stand.
    return { application: app, reply: formatCompletion(app) };
  }

  const issuesBefore = new Set(validateApplication(app).map((issue) => issue.message));
  const extraction = await extractSection(app, focusSection, userMessage, profile);

  // Anything they volunteered about other parts of the form gets recorded too,
  // so a person can correct an earlier answer whenever they think of it rather
  // than only when the interview happens to be pointed at that field.
  const revision = await applyRevisions(
    extraction.merged,
    extraction.alsoMentions,
    userMessage,
    profile
  );

  // Clear the outstanding concern whatever they said. If they stood by their
  // answer nothing changed, so nothing will be raised again and they aren't
  // argued with twice. If they corrected it, the new value is checked afresh.
  const updated: LpaApplication = { ...revision.merged, pendingConcern: null };
  const changed = [...extraction.changed, ...revision.changed];

  const parts: string[] = [];
  const newIssues = validateApplication(updated).filter((issue) => !issuesBefore.has(issue.message));
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
        .map((key) => fieldByKey(key)?.label)
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

  const [concern] = await checkPlausibility(updated, changed);
  if (concern) {
    parts.push(`${concern.concern} ${concern.question}`);
    return { application: { ...updated, pendingConcern: concern.field }, reply: parts.join("\n\n") };
  }

  const askAfter = nextAsk(updated);
  if (!askAfter) {
    parts.push(formatCompletion(updated));
    return { application: updated, reply: parts.join("\n\n") };
  }

  const madeProgress = !askBefore || askAfter.fields[0].key !== askBefore.fields[0].key;
  // Only apologize when the message genuinely produced nothing. Partially
  // answering a question (a species without its hatchery) leaves the same
  // question outstanding, but something was recorded and saying otherwise reads
  // as the app ignoring them.
  if (!madeProgress && !queried && changed.length === 0) {
    parts.push("Sorry, I didn't catch an answer to that one. Let me try again.");
  }

  parts.push(formatAsk(askAfter, madeProgress && askAfter.section !== askBefore?.section));
  return { application: updated, reply: parts.join("\n\n") };
}

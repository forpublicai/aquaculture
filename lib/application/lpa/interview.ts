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
- "None", "no", "not applicable" are real answers. Record them as an empty list \
for a list field, or false for a yes/no field, rather than leaving null.
- Where the applicant gives a number with units, record just the number.

Do not ask questions; you are only recording answers.`;

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
): Promise<{ merged: LpaApplication; changed: LpaFormKey[] }> {
  const keys = fieldsInSection(section)
    .filter((field) => fieldApplies(field, app))
    .map((field) => field.key);
  if (keys.length === 0) return { merged: app, changed: [] };

  const current = Object.fromEntries(keys.map((key) => [key, app[key]]));

  const { object } = await generateObject({
    model: chatModel,
    schema: schemaForFields(keys),
    instructions: EXTRACTION_INSTRUCTIONS,
    prompt:
      `Section of the form: ${sectionById(section).title}\n\n` +
      `Current values (JSON): ${JSON.stringify(current)}\n\n` +
      `Applicant's latest message: ${userMessage}` +
      triageContext(profile),
  });

  const extracted = object as Partial<LpaForm>;
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
  return { merged, changed };
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
  const hints = ask.fields.filter((field) => field.hint);
  if (hints.length > 0) {
    lines.push("");
    for (const field of hints) lines.push(`*${field.label}: ${field.hint}*`);
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
  const { merged, changed } = await extractSection(app, focusSection, userMessage, profile);

  // Clear the outstanding concern whatever they said. If they stood by their
  // answer nothing changed, so nothing will be raised again and they aren't
  // argued with twice. If they corrected it, the new value is checked afresh.
  const updated: LpaApplication = { ...merged, pendingConcern: null };

  const parts: string[] = [];
  const newIssues = validateApplication(updated).filter((issue) => !issuesBefore.has(issue.message));
  if (newIssues.length > 0) parts.push(formatIssues(newIssues));

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
  // Only apologise for missing an answer to the question we actually asked. If
  // they were busy confirming a queried value, the form question is still
  // outstanding by design and nothing went wrong.
  if (!madeProgress && !queried) {
    parts.push("Sorry, I didn't catch an answer to that one. Let me try again.");
  }

  parts.push(formatAsk(askAfter, madeProgress && askAfter.section !== askBefore?.section));
  return { application: updated, reply: parts.join("\n\n") };
}

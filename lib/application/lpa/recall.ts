/**
 * Answering "what have I told you so far?"
 *
 * Mid-interview people ask what's already recorded, what's left, or what they
 * said their email was. None of that is a regulatory question, so the knowledge
 * base can't help, and none of it is an answer, so extraction finds nothing and
 * the interview apologizes at them. Asking the app what it holds is an obvious
 * thing to want and there was no path for it.
 *
 * The application is rendered as labeled prose rather than handed over as JSON.
 * The stored form is full of machine values, `blue_mussel` and
 * `ownership_interest_50_plus` and `WA(A)`, and a model given those will quote
 * them straight back at the applicant.
 */
import { streamText, type UIMessageStreamWriter } from "ai";

import { HOUSE_STYLE } from "@/lib/chat/style";
import { chatModel } from "@/lib/openrouter";

import { LPA_EDITORS, type Control, type RecordPart } from "./editor";
import { fieldApplies, fieldHasContent, LPA_FIELDS, LPA_SECTIONS } from "./fields";
import { applicationProgress } from "./progress";
import { outstandingRequirements } from "./requirements";
import type { LpaApplication, LpaFormKey } from "./schema";

/** "hatcheryLicenseNumber" -> "hatchery license number". */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * The printed name for a value the form offers as a fixed list.
 *
 * `blue_mussel` and `no_gear_bottom_culture` are the shapes those checkbox rows
 * take in storage, and a model handed them will quote them straight back at the
 * applicant. `editor.ts` already holds every one of these lists with the wording
 * printed on the form, which is exactly the wording to read back, so the labels
 * are taken from there rather than kept a second time here.
 */
function printed(control: Control | undefined, value: unknown): string {
  if (control && (control.kind === "choice" || control.kind === "choice_list")) {
    const match = control.choices.find((choice) => choice.value === value);
    if (match) return match.label;
  }
  return String(value);
}

function partsOf(control: Control | undefined): RecordPart[] {
  return control && (control.kind === "record" || control.kind === "record_list") ? control.parts : [];
}

/** One composite entry, led by its species where it has one. */
function describeRecord(parts: RecordPart[], record: Record<string, unknown>): string {
  const byKey = new Map(parts.map((part) => [part.key, part]));
  // Source rows lead with the species, so a table reads as a list of species
  // rather than a run of hatchery addresses.
  const ordered = ["species", ...Object.keys(record).filter((key) => key !== "species")];
  const described: string[] = [];
  for (const key of ordered) {
    const value = record[key];
    if (value === null || value === undefined || value === "") continue;
    const part = byKey.get(key);
    const shown = printed(part?.control, value);
    described.push(key === "species" ? shown : `${humanizeKey(key)} ${shown}`);
  }
  return described.join(", ");
}

/** Renders one stored value as something a person would recognize. */
function describeValue(control: Control | undefined, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    const parts = partsOf(control);
    return value
      .map((entry) =>
        entry !== null && typeof entry === "object"
          ? describeRecord(parts, entry as Record<string, unknown>)
          : printed(control, entry)
      )
      .join("; ");
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    return describeRecord(partsOf(control), value as Record<string, unknown>);
  }
  return printed(control, value);
}

/**
 * One field's value, rendered the way a person reads it.
 *
 * Shared with the PDF overlay, which needs exactly the same rendering: printed
 * species names rather than `blue_mussel`, yes and no rather than true and false.
 */
export function describeField(key: LpaFormKey, app: LpaApplication): string {
  return describeValue(LPA_EDITORS[key], app[key]);
}

/** The whole application as labeled lines, grouped by section. */
export function describeRecordedAnswers(app: LpaApplication): string {
  const lines: string[] = [];

  for (const section of LPA_SECTIONS) {
    const answered = LPA_FIELDS.filter(
      (field) =>
        field.section === section.id && fieldApplies(field, app) && fieldHasContent(field, app)
    );
    if (answered.length === 0) continue;
    lines.push(`${section.title}:`);
    for (const field of answered) {
      lines.push(`  ${field.label}: ${describeValue(LPA_EDITORS[field.key], app[field.key])}`);
    }
  }

  if (lines.length === 0) return "Nothing has been recorded yet.";

  const progress = applicationProgress(app);
  const stillToAsk = progress.missing.map((field) => field.label);
  lines.push(
    "",
    `Answered ${progress.answered} of ${progress.applicable} questions.`,
    stillToAsk.length > 0 ? `Still to ask: ${stillToAsk.join(", ")}.` : "Every question is answered.",
    `Documents and signatures still owed: ${
      outstandingRequirements(app)
        .map((requirement) => requirement.label)
        .join(", ") || "none"
    }.`
  );
  return lines.join("\n");
}

const INSTRUCTIONS = `The applicant is partway through a Maine aquaculture license \
application and is asking about what they've already told you. Answer from the \
record below and nothing else.

- Answer only what they asked. If they ask which species they're farming, name the \
species; don't recite the whole application.
- If the record doesn't hold what they're asking about, say plainly that it hasn't \
been recorded yet.
- Use the everyday names shown in the record, never the internal codes.
- Keep it to a couple of sentences unless they asked for everything.
- Don't offer to change anything. They can just say what they want changed.

${HOUSE_STYLE}`;

/**
 * Streams an answer about the recorded application onto the writer, in the same
 * wire format as the other reply paths.
 */
export async function answerRecall(
  app: LpaApplication,
  question: string,
  writer: UIMessageStreamWriter
): Promise<void> {
  const result = streamText({
    model: chatModel,
    instructions: INSTRUCTIONS,
    prompt: `What has been recorded:\n\n${describeRecordedAnswers(app)}\n\nTheir question: ${question}`,
  });
  writer.merge(result.toUIMessageStream());
}

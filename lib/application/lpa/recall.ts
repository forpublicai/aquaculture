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

import { fieldAnswered, fieldApplies, LPA_FIELDS, LPA_SECTIONS } from "./fields";
import { applicationProgress } from "./progress";
import { outstandingRequirements } from "./requirements";
import { speciesLabel, type LpaApplication } from "./schema";

/** "hatcheryLicenseNumber" -> "hatchery license number". */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Renders one stored value as something a person would recognize. */
function describeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    return value
      .map((entry) => {
        if (entry === null || typeof entry !== "object") return String(entry);
        const record = entry as Record<string, unknown>;
        // Stock rows lead with the species, so the list reads as species names
        // rather than a run of hatchery addresses.
        const parts = "species" in record ? [speciesLabel(record.species as string)] : [];
        for (const [key, val] of Object.entries(record)) {
          if (key === "species" || val === null || val === "") continue;
          parts.push(`${humanizeKey(key)} ${String(val)}`);
        }
        return parts.join(", ");
      })
      .join("; ");
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, val]) => val !== null && val !== "")
      .map(([key, val]) => `${humanizeKey(key)}: ${String(val)}`)
      .join(", ");
  }
  return String(value);
}

/** The whole application as labeled lines, grouped by section. */
export function describeRecordedAnswers(app: LpaApplication): string {
  const lines: string[] = [];

  for (const section of LPA_SECTIONS) {
    const answered = LPA_FIELDS.filter(
      (field) =>
        field.section === section.id && fieldApplies(field, app) && fieldAnswered(field, app)
    );
    if (answered.length === 0) continue;
    lines.push(`${section.title}:`);
    for (const field of answered) {
      lines.push(`  ${field.label}: ${describeValue(app[field.key])}`);
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

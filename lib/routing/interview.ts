/**
 * Conversational intake interview: extracts structured operation details
 * from natural-language messages and drives the license-triage routing.
 */
import { generateObject } from "ai";

import { chatModel } from "@/lib/openrouter";
import { FIELD_PROMPTS, route } from "./rules";
import { OperationProfileSchema, type OperationProfile, type RoutingResult } from "./schema";

const EXTRACTION_SYSTEM_PROMPT = `You extract structured details about a prospective \
Maine aquaculture operation from a conversation, for the purpose of \
recommending which DMR license type the applicant should pursue.

You are given the fields already known from earlier in the conversation, \
plus the applicant's latest message. Return the FULL set of fields:
- Carry forward any already-known field the latest message doesn't contradict.
- Update a field if the latest message gives new or corrected information for it.
- Leave a field null if it has never been mentioned.
- Convert acres to square feet (1 acre = 43,560 sq ft) for siteAreaSqFt.
- Only set isFirstTimeApplicant or wantsToTestBeforeCommitting when the \
applicant has actually said something that implies it — don't guess.

Do not ask questions yourself here; you are only extracting data.`;

export async function updateProfile(
  current: OperationProfile,
  latestUserMessage: string
): Promise<OperationProfile> {
  const { object } = await generateObject({
    model: chatModel,
    schema: OperationProfileSchema,
    instructions: EXTRACTION_SYSTEM_PROMPT,
    prompt: `Fields already known (JSON): ${JSON.stringify(current)}\n\nApplicant's latest message: ${latestUserMessage}`,
  });
  return object;
}

export function nextQuestion(profile: OperationProfile): string {
  const routing = route(profile);
  if (routing.missingFields.length === 0) return "";
  const field = routing.missingFields[0];
  return `Could you tell me ${FIELD_PROMPTS[field]}?`;
}

export function formatRecommendation(routing: RoutingResult): string {
  const lines = [
    `Based on what you've described, this sounds like a fit for a **${routing.licenseType}**.`,
    "",
    routing.rationale,
  ];
  if (routing.incompatibilityWarning) {
    lines.push("", `⚠️ ${routing.incompatibilityWarning}`);
  }
  lines.push(
    "",
    "This is a preliminary read, not a final determination — feel free to ask me " +
      "regulatory questions about this license type, or double-check details with DMR " +
      "directly before applying."
  );
  return lines.join("\n");
}

export async function runInterviewTurn(
  current: OperationProfile,
  userMessage: string
): Promise<{ profile: OperationProfile; routing: RoutingResult; reply: string }> {
  const profile = await updateProfile(current, userMessage);
  const routing = route(profile);

  const reply = routing.missingFields.length > 0 ? nextQuestion(profile) : formatRecommendation(routing);
  return { profile, routing, reply };
}

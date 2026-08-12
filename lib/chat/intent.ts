/**
 * Per-message intent classification, so the chat session can route between
 * the license-triage interview and regulatory Q&A.
 */
import { generateObject } from "ai";
import { z } from "zod";

import { chatModel } from "@/lib/openrouter";

export const IntentSchema = z.enum(["license_triage", "regulatory_question", "other"]);
export type Intent = z.infer<typeof IntentSchema>;

const INTENT_INSTRUCTIONS = `Classify the applicant's latest chat message into exactly \
one category:

- license_triage: describes their (prospective) operation or answers a scoping \
question about species, gear/cultivation method, site size, or lease duration.
- regulatory_question: asks about rules, requirements, definitions, fees, \
timelines, or the application process itself.
- other: greetings, thanks, or anything unrelated to either of the above.`;

export async function classifyIntent(message: string): Promise<Intent> {
  const { object } = await generateObject({
    model: chatModel,
    schema: z.object({ intent: IntentSchema }),
    instructions: INTENT_INSTRUCTIONS,
    prompt: message,
  });
  return object.intent;
}

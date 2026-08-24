/**
 * A second opinion on what the applicant just told us.
 *
 * Each form's own `validate` checks what can be known for certain: arithmetic,
 * regulatory limits, fields that contradict each other by rule. It has no way
 * to know that Portland is in Cumberland County and not Waldo, because that's
 * outside knowledge rather than a rule in the form.
 *
 * This fills that gap with a model call, under three constraints that matter:
 *
 * 1. **It asks, it never corrects.** A concern becomes a question and the
 *    applicant's answer wins. This is their legal document, and a model that
 *    quietly "fixes" a town name it was wrong about is far more damaging than
 *    one that asks an unnecessary question.
 * 2. **Only changed fields can be flagged.** Re-checking the whole application
 *    every turn would cost a fortune and would re-raise concerns the applicant
 *    has already dismissed. If they restate a value unchanged, nothing is
 *    flagged, which is what stops it arguing in a loop.
 * 3. **It stays quiet unless confident.** The instructions push hard toward
 *    silence, because a wrong challenge trains people to click past warnings,
 *    which is precisely the habit that gets an application denied.
 *
 * Which fields are worth checking, and what context the model may reason over,
 * is the form's call: free-text narrative is skipped via `def.narrativeKeys`,
 * and the cross-reference set comes from `def.plausibilityContextKeys`.
 */
import { generateObject } from "ai";
import { z } from "zod";

import { HOUSE_STYLE } from "@/lib/chat/style";
import { chatModel } from "@/lib/openrouter";

import { fieldByKey, type AnyApplication, type LicenseDefinition } from "./definition";

function compactForContext(def: LicenseDefinition, key: string, value: unknown): unknown {
  const parts = def.plausibilityContextParts?.[key];
  if (!parts || !Array.isArray(value)) return value;
  return value.filter(Boolean).map((entry) => {
    const record = entry as Record<string, unknown>;
    return Object.fromEntries(
      parts.filter((part) => record?.[part] != null).map((part) => [part, record[part]])
    );
  });
}

const ConcernsSchema = z.object({
  concerns: z.array(
    z.object({
      field: z
        .string()
        .describe("The key of the just-supplied field the concern is about."),
      concern: z
        .string()
        .describe("One sentence on what looks wrong, stating the fact you're relying on."),
      question: z
        .string()
        .describe("How to put it to the applicant, ending in a question mark."),
    })
  ),
});

export interface PlausibilityConcern {
  field: string;
  concern: string;
  question: string;
}

function buildInstructions(today: string): string {
  return `You are checking a Maine aquaculture license application for factual \
mistakes, the way a careful clerk would before it goes in the post. Today's date \
is ${today}.

You'll be given the values the applicant has just supplied, plus already-known \
context about their site and their application. Flag anything factually wrong, or \
anything that can't be true alongside something else. The kinds worth looking for:

- A town paired with the wrong county.
- A waterbody that isn't at or near the stated town.
- Coordinates that don't fall near the stated town.
- A city and state or ZIP code that don't go together.
- A health zone that doesn't match where the site is.
- A depth that can't be right for where the site sits in the tide. An intertidal \
site is dry at low water, so a large depth at mean low water contradicts it.
- Gear that doesn't suit the species, such as scallop gear where no scallops are \
listed, or no gear at all alongside gear categories.
- A stated size or term that contradicts what was said elsewhere.
- A date in the future, or one implausibly far in the past.
- Surroundings that contradict each other, such as nothing within 1,000 feet at a \
site inside a marina slip.

IMPORTANT: name the field from the just-supplied list, even when the contradiction \
is with something in the context. A concern naming a context-only field is \
discarded, so the applicant would never see it.

Judge only what you are confident about. Maine geography is well documented and \
you should trust yourself on well-known towns, counties and bays. If a place is \
obscure, if you're unsure, or if a value is merely unusual rather than wrong, say \
nothing. Returning an empty list is the right answer most of the time and costs \
nothing.

Never flag:
- Spelling, capitalization, phrasing or formatting.
- Values that are simply surprising, like an unusually small site.
- Anything the form itself already checks, such as a size over a regulatory limit.
- A field that is null or blank. It hasn't been answered yet.

For each concern, state the fact you're relying on so the applicant can judge \
whether you're right. Then write the question you'd put to them, asking which they \
meant. Don't state what the value should be as though it were settled, and don't \
apologize.

${HOUSE_STYLE}`;
}

/**
 * Returns concerns about `changedKeys`, or an empty list. Never throws: a failed
 * or malformed check must not take down the interview turn that triggered it,
 * since the applicant's answer has already been recorded by that point.
 */
export async function checkPlausibility(
  def: LicenseDefinition,
  app: AnyApplication,
  changedKeys: string[],
  now: Date = new Date()
): Promise<PlausibilityConcern[]> {
  const narrative = def.narrativeKeys ?? new Set<string>();
  const checkable = changedKeys.filter((key) => !narrative.has(key) && app[key] !== null);
  if (checkable.length === 0) return [];

  const changed = Object.fromEntries(
    checkable.map((key) => [key, { label: fieldByKey(def, key)?.label ?? key, value: app[key] }])
  );
  const context = Object.fromEntries(
    (def.plausibilityContextKeys ?? [])
      .filter((key) => !checkable.includes(key) && app[key] !== null && app[key] !== undefined)
      .map((key) => [key, compactForContext(def, key, app[key])])
  );

  try {
    const { object } = await generateObject({
      model: chatModel,
      schema: ConcernsSchema,
      instructions: buildInstructions(now.toISOString().slice(0, 10)),
      prompt:
        `Just supplied (JSON): ${JSON.stringify(changed)}\n\n` +
        `Already known about this application (JSON): ${JSON.stringify(context)}\n\n` +
        `Every concern must name one of these fields: ${checkable.join(", ")}`,
    });

    return object.concerns
      // A concern naming a context-only or invented field would produce a
      // question about something the applicant didn't just tell us, so only
      // concerns about the changed values survive.
      .filter((concern) => checkable.includes(concern.field))
      .map((concern) => ({
        field: concern.field,
        concern: concern.concern,
        question: concern.question,
      }));
  } catch {
    return [];
  }
}

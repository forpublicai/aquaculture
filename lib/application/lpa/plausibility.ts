/**
 * A second opinion on what the applicant just told us.
 *
 * `progress.ts` validates what can be known for certain: arithmetic, regulatory
 * limits, fields that contradict each other by rule. It has no way to know that
 * Portland is in Cumberland County and not Waldo, because that's outside
 * knowledge rather than a rule in the form.
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
 * Free-text narrative fields are skipped entirely. There's nothing checkable in
 * someone's description of the seabed, and asking a model to find fault in prose
 * invites it to invent problems.
 */
import { generateObject } from "ai";
import { z } from "zod";

import { HOUSE_STYLE } from "@/lib/chat/style";
import { chatModel } from "@/lib/openrouter";

import { fieldByKey } from "./fields";
import type { LpaApplication, LpaFormKey } from "./schema";

/**
 * Fields holding the applicant's own prose. Nothing here can be checked against
 * outside fact, so a turn that only changes these never triggers a call.
 */
const NARRATIVE_KEYS: ReadonlySet<string> = new Set([
  "uplandsDescription",
  "bottomCharacteristics",
  "siteDescription",
  "mooringDescription",
  "seasonalGearChanges",
  "birdDeterrenceMeasures",
  "eelgrassDescription",
  "commercialFishingUse",
  "recreationalFishingUse",
  "boatingUse",
  "otherWaterUse",
  "nearbyFeatures",
]);

/**
 * What the model gets to cross-reference against, beyond the fields that just
 * changed.
 *
 * This list is the check's actual reach. A contradiction can only be spotted if
 * *both* halves are visible, so anything missing here creates a one-way blind
 * spot: name a species and it can weigh that against the gear, but change the
 * gear later and it never sees the species. Grouped by what each cluster lets it
 * reason about.
 */
const CONTEXT_KEYS: LpaFormKey[] = [
  // Where the site is.
  "town",
  "county",
  "waterbody",
  "latitude",
  "longitude",
  "lpaHealthZone",
  "growingAreaDesignation",
  "isInRestrictedOrProhibitedArea",
  // How it sits in the water. Lets a stated depth be weighed against whether the
  // site is intertidal.
  "isAboveMeanLowWater",
  "isAboveExtremeLowWater",
  "isMarinaOrPoundSite",
  "depthAtMeanLowWaterFt",
  "depthAtMeanHighWaterFt",
  // What's grown and how. Lets gear be weighed against species, and the
  // upweller-only exemption against the gear actually proposed.
  "species",
  "hatcherySources",
  "wildSources",
  "gearCategories",
  "gearLayoutWidthFt",
  "gearLayoutLengthFt",
  "purpose",
  "ownerOperatorExemption",
  // Who's applying.
  "applicantCity",
  "applicantStateZip",
  "isMaineResident",
  // Surroundings.
  "hasNoNearbyFeatures",
  "hasShorefrontWithin300Ft",
  "riparianMunicipality",
];

/**
 * Shrinks a context value to the part worth reasoning about.
 *
 * The source tables carry addresses, phone numbers and license numbers, none of
 * which help decide whether the gear suits the species or whether a stated town
 * sits in the stated county. Sending them whole would pay for tokens on every
 * turn to no purpose and bury the fields that do matter in noise. What is kept
 * is the species and the one detail a contradiction could turn on: which
 * hatchery, or which waterbody and health zone.
 *
 * The species list itself needs no shrinking, which is a small dividend of the
 * split: what is grown is now a short list of names rather than a table.
 */
const CONTEXT_PARTS: Partial<Record<LpaFormKey, string[]>> = {
  hatcherySources: ["species", "hatcheryName"],
  wildSources: ["species", "waterbody", "healthZone"],
};

function compactForContext(key: LpaFormKey, value: unknown): unknown {
  const parts = CONTEXT_PARTS[key];
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
  field: LpaFormKey;
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
- An owner/operator exemption that doesn't match the application, such as \
claiming the upweller-only exemption while proposing other gear.
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
- Anything the form itself already checks, such as a gear area over the limit or \
wild stock from the wrong health zone.
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
  app: LpaApplication,
  changedKeys: LpaFormKey[],
  now: Date = new Date()
): Promise<PlausibilityConcern[]> {
  const checkable = changedKeys.filter((key) => !NARRATIVE_KEYS.has(key) && app[key] !== null);
  if (checkable.length === 0) return [];

  const changed = Object.fromEntries(
    checkable.map((key) => [key, { label: fieldByKey(key)?.label ?? key, value: app[key] }])
  );
  const context = Object.fromEntries(
    CONTEXT_KEYS.filter((key) => !checkable.includes(key) && app[key] !== null).map((key) => [
      key,
      compactForContext(key, app[key]),
    ])
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
      .filter((concern) => checkable.includes(concern.field as LpaFormKey))
      .map((concern) => ({
        field: concern.field as LpaFormKey,
        concern: concern.concern,
        question: concern.question,
      }));
  } catch {
    return [];
  }
}

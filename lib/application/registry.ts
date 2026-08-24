/**
 * Every license application this app knows how to fill in.
 *
 * The registry is the one place that knows more than one form exists. The
 * chat session asks it which definition a routing recommendation opens, and
 * which definition a stored draft belongs to; everything downstream takes a
 * `LicenseDefinition` and stays ignorant of the roster.
 *
 * A draft records which form it is in its own `licenseType` key (the
 * definition's id, not the routing enum's display string). Drafts written
 * before that key existed are all LPAs — the LPA was the only form — so "lpa"
 * is the default reading, not a guess.
 *
 * The Standard lease registers twice, because DMR's process files two
 * applications: the draft (opened by triage) and the final (reached only by
 * advancing from a completed draft). `seededByTriage: false` is what keeps the
 * final out of triage's reach.
 */
import type { LicenseType } from "@/lib/routing/schema";
import type { OperationProfile } from "@/lib/routing/schema";

import type { AnyApplication, LicenseDefinition } from "./definition";
import { EXPERIMENTAL_DEFINITION } from "./experimental/definition";
import { LPA_DEFINITION } from "./lpa/definition";
import {
  STANDARD_DRAFT_DEFINITION,
  STANDARD_FINAL_DEFINITION,
} from "./standard/definition";

export const DEFINITIONS: Record<string, LicenseDefinition> = {
  [LPA_DEFINITION.id]: LPA_DEFINITION,
  [EXPERIMENTAL_DEFINITION.id]: EXPERIMENTAL_DEFINITION,
  [STANDARD_DRAFT_DEFINITION.id]: STANDARD_DRAFT_DEFINITION,
  [STANDARD_FINAL_DEFINITION.id]: STANDARD_FINAL_DEFINITION,
};

/** The definition a triage recommendation opens, or null for types not yet built. */
export function definitionForLicenseType(licenseType: LicenseType): LicenseDefinition | null {
  return (
    Object.values(DEFINITIONS).find(
      (definition) =>
        definition.licenseType === licenseType && definition.seededByTriage !== false
    ) ?? null
  );
}

/** The definition a stored draft belongs to. Every draft has one. */
export function definitionForApplication(app: AnyApplication): LicenseDefinition {
  const id = typeof app.licenseType === "string" ? app.licenseType : "lpa";
  return DEFINITIONS[id] ?? DEFINITIONS.lpa;
}

/** A fresh draft for a definition, tagged with the form it belongs to. */
export function seedApplication(
  def: LicenseDefinition,
  profile: OperationProfile
): AnyApplication {
  return { ...def.seed(profile), licenseType: def.id };
}

/**
 * Reads whatever is stored against a conversation and hands back a current
 * draft, or null if there isn't one. Dispatches to the owning form's own
 * migration, and re-attaches the registry-managed keys afterwards: each form's
 * migrate filters to its own schema keys, and `licenseType` and `predecessor`
 * are deliberately on none of them, so neither extraction nor the review
 * screen's edit path can ever write them.
 */
export function migrateStoredApplication(stored: unknown): AnyApplication | null {
  if (!stored || typeof stored !== "object") return null;
  const raw = stored as Record<string, unknown>;
  const def = definitionForApplication(raw);
  const migrated: AnyApplication = { ...def.migrate(raw), licenseType: def.id };
  // The stashed predecessor is opaque history, not part of any form: carried
  // as stored, and read defensively by whoever displays it.
  if (raw.predecessor && typeof raw.predecessor === "object") {
    migrated.predecessor = raw.predecessor;
  }
  return migrated;
}

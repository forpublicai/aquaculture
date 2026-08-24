/**
 * Bringing a stored Experimental lease draft into the current shape.
 *
 * This form has no legacy shapes yet, so migration is the generic half of what
 * the LPA's does: keys the form no longer has are dropped (every save spreads
 * the whole object, so a stale key would outlive its field forever), keys the
 * form has gained arrive unanswered, and a draft that fails to parse afterwards
 * is still returned rather than discarded, because losing an applicant's work
 * is the worse outcome and the rest of the app reads these values defensively.
 */
import {
  EMPTY_EXPERIMENTAL_APPLICATION,
  ExperimentalApplicationSchema,
  type ExperimentalApplication,
} from "./schema";

export function migrateApplication(stored: unknown): ExperimentalApplication | null {
  if (!stored || typeof stored !== "object") return null;
  const raw = stored as Record<string, unknown>;

  const known = new Set(Object.keys(ExperimentalApplicationSchema.shape));
  const application: ExperimentalApplication = { ...EMPTY_EXPERIMENTAL_APPLICATION };
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) continue;
    (application as Record<string, unknown>)[key] = value;
  }

  const parsed = ExperimentalApplicationSchema.safeParse(application);
  if (parsed.success) return parsed.data;

  console.warn(
    "[experimental] stored application did not match the current form:",
    parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`)
  );
  return application;
}

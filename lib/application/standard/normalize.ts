/**
 * Bringing a stored Standard lease draft into the current shape.
 *
 * Neither form has legacy shapes yet, so this is the generic treatment both
 * ways: keys the form no longer has are dropped (every save spreads the whole
 * object, so a stale key would outlive its field forever), keys it has gained
 * arrive unanswered, and a draft that fails to parse afterwards is still
 * returned rather than discarded, because losing an applicant's work is the
 * worse outcome and the rest of the app reads these values defensively.
 */
import {
  EMPTY_STANDARD_DRAFT_APPLICATION,
  EMPTY_STANDARD_FINAL_APPLICATION,
  StandardDraftApplicationSchema,
  StandardFinalApplicationSchema,
  type StandardDraftApplication,
  type StandardFinalApplication,
} from "./schema";

function migrate<T extends object>(
  stored: unknown,
  schema: { shape: Record<string, unknown>; safeParse: (v: unknown) => { success: boolean; data?: unknown } },
  empty: T,
  formName: string
): T | null {
  if (!stored || typeof stored !== "object") return null;
  const raw = stored as Record<string, unknown>;

  const known = new Set(Object.keys(schema.shape));
  const application = { ...empty } as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) continue;
    application[key] = value;
  }

  const parsed = schema.safeParse(application);
  if (parsed.success) return parsed.data as T;

  console.warn(`[${formName}] stored application did not match the current form.`);
  return application as T;
}

export function migrateDraftApplication(stored: unknown): StandardDraftApplication | null {
  return migrate(
    stored,
    StandardDraftApplicationSchema,
    EMPTY_STANDARD_DRAFT_APPLICATION,
    "standard-draft"
  );
}

export function migrateFinalApplication(stored: unknown): StandardFinalApplication | null {
  return migrate(
    stored,
    StandardFinalApplicationSchema,
    EMPTY_STANDARD_FINAL_APPLICATION,
    "standard-final"
  );
}

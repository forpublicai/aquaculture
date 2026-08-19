/**
 * Applying one hand-made correction to a draft application.
 *
 * Split out from the route that serves it so the rules below can be read, and
 * exercised, without an HTTP request or a database around them. Everything here
 * is pure: an application in, an application or a reason out.
 *
 * Everything else writing to `conversations.application` goes through the
 * interview, which means through a model. This is the one path that doesn't:
 * the applicant edits a field on the review screen and it is written exactly as
 * typed. That makes it the only way to *remove* an answer, which extraction
 * structurally cannot do, since a null from the model means "not mentioned",
 * never "erased".
 *
 * Two guards matter.
 *
 * **The key has to be a form field.** `LpaApplicationSchema` is `LpaFormSchema`
 * plus `externalRequirements` and `pendingConcern`, and this validates against
 * `LpaFormSchema.shape`, so neither of those can be written through the field
 * path. It's the same split that stops the extraction model inventing a
 * signature, applied to the same risk arriving over HTTP.
 *
 * **The value has to parse.** Each field is checked against its own schema, so
 * a latitude arrives as a number and a gear category as one of the ten printed
 * values, whatever the client sent.
 *
 * Requirement statuses are edited through their own branch, since they aren't
 * form fields at all: they're the applicant's own record of which drawings and
 * signatures they've obtained, and the app has no way to check them.
 */
import { seedSourceRows } from "./normalize";
import { LPA_REQUIREMENTS } from "./requirements";
import {
  LpaFormSchema,
  RequirementStatus,
  type LpaApplication,
  type LpaFormKey,
} from "./schema";

interface FieldEdit {
  type: "field";
  key: string;
  /** Already the field's own shape: null to clear, otherwise a parsed value. */
  value: unknown;
}

interface RequirementEdit {
  type: "requirement";
  id: string;
  status: string;
}

export type ApplicationEdit = FieldEdit | RequirementEdit;

function isFormKey(key: string): key is LpaFormKey {
  return Object.prototype.hasOwnProperty.call(LpaFormSchema.shape, key);
}

/** Applies one edit to a copy of the application, or explains why it can't be. */
export function applyEdit(
  application: LpaApplication,
  edit: ApplicationEdit
): { application: LpaApplication } | { error: string } {
  const next: LpaApplication = { ...application };

  if (edit.type === "requirement") {
    const requirement = LPA_REQUIREMENTS.find((candidate) => candidate.id === edit.id);
    if (!requirement) return { error: `Unknown requirement: ${edit.id}` };

    const status = RequirementStatus.safeParse(edit.status);
    if (!status.success) return { error: `Unknown status: ${edit.status}` };

    next.externalRequirements = {
      ...(application.externalRequirements ?? {}),
      [requirement.id]: status.data,
    };
    return { application: next };
  }

  if (!isFormKey(edit.key)) {
    return { error: `${edit.key} is not a field on the LPA application form.` };
  }

  const parsed = LpaFormSchema.shape[edit.key].safeParse(edit.value);
  if (!parsed.success) {
    // The first issue is the useful one; a nested list produces one per row and
    // showing all of them under a single input is noise.
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return { error: `${path}${issue.message}` };
  }

  // A computed key on a spread widens the type, so the write is done as its own
  // statement against the record view of the object.
  (next as Record<string, unknown>)[edit.key] = parsed.data;

  // If a plausibility check had queried this very field, editing it by hand is
  // the answer to that query. Leaving the concern set would make the next
  // chat message get extracted into this field's section instead of wherever
  // the interview has moved on to.
  if (application.pendingConcern === edit.key) next.pendingConcern = null;

  // Ticking a species box on the review screen opens the row its source belongs
  // in, for the species the form gives no choice about. Same call the interview
  // makes, so both ways of naming a species behave alike.
  return { application: seedSourceRows(application, next) };
}

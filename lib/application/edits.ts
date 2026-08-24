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
 * **The key has to be a form field.** The stored application is the form plus
 * meta keys — `externalRequirements`, `pendingConcern`, `deferredFields`,
 * `stalledOn`, and `licenseType` itself — and this validates against the form
 * schema's shape, so none of those can be written through the field path. It's
 * the same split that stops the extraction model inventing a signature, applied
 * to the same risk arriving over HTTP.
 *
 * **The value has to parse.** Each field is checked against its own schema, so
 * a latitude arrives as a number and a checkbox as one of its printed values,
 * whatever the client sent.
 */
import {
  RequirementStatus,
  type AnyApplication,
  type LicenseDefinition,
} from "./definition";

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

/** Applies one edit to a copy of the application, or explains why it can't be. */
export function applyEdit(
  def: LicenseDefinition,
  application: AnyApplication,
  edit: ApplicationEdit
): { application: AnyApplication } | { error: string } {
  const next: AnyApplication = { ...application };

  if (edit.type === "requirement") {
    const requirement = def.requirements.find((candidate) => candidate.id === edit.id);
    if (!requirement) return { error: `Unknown requirement: ${edit.id}` };

    const status = RequirementStatus.safeParse(edit.status);
    if (!status.success) return { error: `Unknown status: ${edit.status}` };

    const existing = application.externalRequirements;
    next.externalRequirements = {
      ...(existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}),
      [requirement.id]: status.data,
    };
    return { application: next };
  }

  const shape = def.formSchema.shape;
  if (!Object.prototype.hasOwnProperty.call(shape, edit.key)) {
    return { error: `${edit.key} is not a field on the ${def.shortName} form.` };
  }

  const parsed = shape[edit.key].safeParse(edit.value);
  if (!parsed.success) {
    // The first issue is the useful one; a nested list produces one per row and
    // showing all of them under a single input is noise.
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return { error: `${path}${issue.message}` };
  }

  next[edit.key] = parsed.data;

  // If a plausibility check had queried this very field, editing it by hand is
  // the answer to that query. Leaving the concern set would make the next
  // chat message get extracted into this field's section instead of wherever
  // the interview has moved on to.
  if (application.pendingConcern === edit.key) next.pendingConcern = null;

  // A form may react to the edit — the LPA opens the source row a newly ticked
  // species belongs in. Same hook the interview's merge uses, so both ways of
  // naming a species behave alike.
  return { application: def.afterMerge ? def.afterMerge(application, next) : next };
}

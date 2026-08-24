/**
 * The parts of an application this app cannot produce, resolved against one
 * form's catalog.
 *
 * Each license type declares its own requirements — the LPA's harbormaster
 * signature, the Experimental lease's financial-institution letter — and this
 * module only answers which of them apply and where each one stands. Statuses
 * live in `application.externalRequirements` keyed by id; a missing key means
 * "not_started". Nothing here is ever set by a model.
 */
import type { AnyApplication, LicenseDefinition, RequirementState, RequirementStatus } from "./definition";

function statusesOf(app: AnyApplication): Record<string, RequirementStatus> {
  const value = app.externalRequirements;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, RequirementStatus>)
    : {};
}

/** The requirements that apply to this application, with their current status. */
export function applicableRequirements(
  def: LicenseDefinition,
  app: AnyApplication
): RequirementState[] {
  const statuses = statusesOf(app);
  return def.requirements
    .filter((req) => (req.appliesWhen ? req.appliesWhen(app) : true))
    .map((req) => ({ ...req, status: statuses[req.id] ?? "not_started" }));
}

/** Requirements the applicant still owes — i.e. not done and not waived. */
export function outstandingRequirements(
  def: LicenseDefinition,
  app: AnyApplication
): RequirementState[] {
  return applicableRequirements(def, app).filter(
    (req) => req.status !== "done" && req.status !== "not_applicable"
  );
}

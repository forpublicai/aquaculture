/**
 * Advancing from one application to its successor: the Standard lease's draft
 * to its final application.
 *
 * The carry-over is a mechanical copy of the intersection, guarded twice. A key
 * carries only if both form schemas declare it — the schemas share keys exactly
 * where the printed questions match, which is a discipline schema.ts keeps, not
 * a coincidence this relies on hopefully — and only if the successor's own
 * schema accepts the value, so a value written under an older shape can never
 * smuggle itself forward. Nothing is inferred, reworded, or filled in: a
 * question only the successor asks starts unanswered, exactly as if the form
 * had just been opened.
 *
 * Requirement statuses carry by the same rule: an id both catalogs declare
 * keeps its status, because a boundary drawing obtained for the draft is
 * obtained. The rest of the meta starts clean — a concern about a draft answer
 * or a question the draft set aside is not a fact about the new form.
 *
 * The old application is not discarded. It rides along under `predecessor`,
 * managed by the registry the same way `licenseType` is: on no form schema, so
 * neither extraction nor the review screen's edit path can ever touch it, and
 * preserved through migration.
 */
import {
  emptyApplicationMeta,
  RequirementStatus,
  type AnyApplication,
  type LicenseDefinition,
} from "./definition";

export function advanceApplication(
  from: LicenseDefinition,
  to: LicenseDefinition,
  app: AnyApplication
): AnyApplication {
  const advanced: AnyApplication = { ...to.emptyApplication(), ...emptyApplicationMeta() };

  for (const key of Object.keys(to.formSchema.shape)) {
    if (!Object.prototype.hasOwnProperty.call(from.formSchema.shape, key)) continue;
    const value = app[key];
    if (value === null || value === undefined) continue;
    const parsed = to.formSchema.shape[key].safeParse(value);
    if (parsed.success) advanced[key] = parsed.data;
  }

  const fromStatuses =
    app.externalRequirements && typeof app.externalRequirements === "object"
      ? (app.externalRequirements as Record<string, unknown>)
      : {};
  const carriedStatuses: Record<string, string> = {};
  for (const requirement of to.requirements) {
    if (!from.requirements.some((candidate) => candidate.id === requirement.id)) continue;
    const status = RequirementStatus.safeParse(fromStatuses[requirement.id]);
    if (status.success) carriedStatuses[requirement.id] = status.data;
  }
  advanced.externalRequirements = carriedStatuses;

  // The predecessor rides along whole, minus any predecessor of its own: one
  // level of history is what the review needs, and unbounded nesting is how a
  // stored row grows without limit.
  const { predecessor: _dropped, ...flattened } = app;
  void _dropped;
  advanced.predecessor = { ...flattened, licenseType: from.id };

  return { ...advanced, licenseType: to.id };
}

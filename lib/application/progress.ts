/**
 * How complete is this application?
 *
 * Completeness is the same computation for every license type — which
 * applicable fields are still blank — so it lives here and takes the form's
 * definition. What's *wrong* with an application is a different question with a
 * different answer per form, so validation stays in each form's own module and
 * is reached through `def.validate`.
 */
import {
  fieldApplies,
  type AnyApplication,
  type FieldDef,
  type LicenseDefinition,
} from "./definition";

export type { ValidationIssue } from "./definition";

export interface SectionProgress {
  id: string;
  title: string;
  answered: number;
  applicable: number;
  complete: boolean;
}

export interface ApplicationProgress {
  answered: number;
  applicable: number;
  /** 0-100, rounded. 100 only when nothing applicable is outstanding. */
  percent: number;
  complete: boolean;
  missing: FieldDef[];
  sections: SectionProgress[];
}

export function applicationProgress(
  def: LicenseDefinition,
  app: AnyApplication
): ApplicationProgress {
  const applicable = def.fields.filter((field) => fieldApplies(field, app));
  const missing = applicable.filter((field) => !def.fieldAnswered(field, app));
  const answered = applicable.length - missing.length;

  const sections: SectionProgress[] = def.sections
    .map((section) => {
      const inSection = applicable.filter((field) => field.section === section.id);
      const answeredHere = inSection.filter((field) => def.fieldAnswered(field, app)).length;
      return {
        id: section.id,
        title: section.title,
        answered: answeredHere,
        applicable: inSection.length,
        complete: inSection.length > 0 && answeredHere === inSection.length,
      };
    })
    // A section whose fields are all conditional and all ruled out isn't part of
    // this application at all, so it shouldn't appear as "0 of 0 complete".
    .filter((section) => section.applicable > 0);

  return {
    answered,
    applicable: applicable.length,
    percent: applicable.length === 0 ? 0 : Math.round((answered / applicable.length) * 100),
    complete: missing.length === 0,
    missing,
    sections,
  };
}

/**
 * What a license application *is*, to the machinery that runs one.
 *
 * Until Phase C the app knew one form, and every module simply imported the LPA
 * catalog it needed. Adding a second license type forced the question of which
 * parts of the intake are the form and which parts are the machine. The answer
 * is here: a `LicenseDefinition` is everything the interview, the review screen,
 * the recall path and the PDF output need to know about one license type, and
 * everything outside `lib/application/<type>/` works only through it.
 *
 * The types are deliberately loose. Each form keeps its own precisely typed
 * modules — `LpaApplication`, `LpaFormKey` and so on — and the shared machinery
 * sees `Record<string, unknown>`, because it reads values that came from a
 * model and round-tripped through JSONB, which the LPA code already treats as
 * "a hope, not a guarantee". The callbacks are declared in method syntax on
 * purpose: TypeScript checks methods bivariantly, which is what lets a catalog
 * written against `LpaApplication` satisfy an interface written against the
 * loose shape without a cast at every site.
 */
import { z } from "zod";

import type { LicenseType, OperationProfile } from "@/lib/routing/schema";

import { choicesFrom, REQUIREMENT_STATUS_LABELS, type Choice, type Control } from "./controls";

/** A stored application draft, as the shared machinery sees it. */
export type AnyApplication = Record<string, unknown>;

export interface Section {
  id: string;
  title: string;
  /** One line of orientation, shown when the interview moves into the section. */
  blurb: string;
}

export interface FieldDef {
  key: string;
  section: string;
  /** Short label for the sidebar and review screen. */
  label: string;
  /** How to ask for it in conversation. */
  question: string;
  /**
   * A question written against the answers already given, used in place of
   * `question` when it returns something.
   */
  questionFor?(app: AnyApplication): string | null;
  /** Extra context worth showing the applicant, where the form is unobvious. */
  hint?: string;
  /** When present, the field is only part of the application if this returns true. */
  appliesWhen?(app: AnyApplication): boolean;
  /** True when an empty list is a real answer rather than an unanswered question. */
  emptyListIsAnswer?: boolean;
  /** Composite objects that need their own notion of "filled in", per form. */
  kind?: string;
  /** Form-specific detail hung off a `kind`; the shared machinery ignores it. */
  sourceTable?: string;
}

export const RequirementStatus = z.enum(["not_started", "in_progress", "done", "not_applicable"]);
export type RequirementStatus = z.infer<typeof RequirementStatus>;

/** The status dropdown every form's requirement tracker renders. */
export const REQUIREMENT_STATUS_CHOICES: Choice[] = choicesFrom(
  RequirementStatus.options,
  REQUIREMENT_STATUS_LABELS
);

export type RequirementKind = "attachment" | "signature" | "payment" | "external_permit";

export interface RequirementDef {
  id: string;
  kind: RequirementKind;
  label: string;
  /** What the applicant actually has to do, in plain terms. */
  detail: string;
  appliesWhen?(app: AnyApplication): boolean;
}

export interface RequirementState extends RequirementDef {
  status: RequirementStatus;
}

export interface ValidationIssue {
  /** "blocking" means the site, as described, can't be licensed this way. */
  severity: "blocking" | "warning";
  field: string | null;
  message: string;
}

/**
 * The structural slice of a Zod object schema the machinery needs. Typed this
 * way rather than `z.ZodObject<...>` because the generic parameter would make
 * each form's precisely-shaped schema unassignable without a cast.
 */
export interface FormSchema {
  shape: Record<string, z.ZodTypeAny>;
}

/** How the application is produced as a document, when it can be. */
export interface PdfOutput {
  /** The official form, committed under data/forms/ so a fresh clone has it. */
  formFile: string;
  /**
   * The coordinate map for drawing answers onto the form, if one has been
   * measured. Without it, every answer goes to a continuation sheet appended
   * after the untouched official form — slower to transcribe, but nothing the
   * applicant said is ever dropped.
   */
  mapFile?: string;
  /** Base filename for the download, without extension. */
  downloadName: string;
  /**
   * Checkbox groups on the form that are ticked per *row* of a list field
   * rather than against the field's own value: map key prefix to the row
   * values present. Only forms with an overlay map need this.
   */
  checkboxRowLists?(app: AnyApplication): Record<string, string[]>;
}

/**
 * One license type's application, complete: what the form asks, how to ask it,
 * how to edit it, what can't be produced, and what to check.
 */
export interface LicenseDefinition {
  /** Stable id, stored on every draft as `licenseType`. Never rename one. */
  id: string;
  /** The routing recommendation that opens this application. */
  licenseType: LicenseType;
  /** How the applicant sees it named: "LPA license application". */
  shortName: string;
  /** How prompts name the form, fully: "Maine DMR's ... application". */
  formTitle: string;

  sections: Section[];
  fields: FieldDef[];
  /** The form's own fields — what extraction and hand edits may write. */
  formSchema: FormSchema;
  /** A fresh draft with every field unanswered and the meta keys in place. */
  emptyApplication(): AnyApplication;
  editors: Record<string, Control>;
  requirements: RequirementDef[];

  fieldAnswered(field: FieldDef, app: AnyApplication): boolean;
  fieldHasContent(field: FieldDef, app: AnyApplication): boolean;
  validate(app: AnyApplication, now?: Date): ValidationIssue[];
  /** Reads whatever is stored and hands back a current draft. Never throws. */
  migrate(stored: Record<string, unknown>): AnyApplication;
  /** Carries what triage already learned into a blank application. */
  seed(profile: OperationProfile): AnyApplication;
  /**
   * Reacts to a merge or hand edit, e.g. opening the source row a newly named
   * species needs. Must be pure and idempotent.
   */
  afterMerge?(previous: AnyApplication, next: AnyApplication): AnyApplication;

  /** Fields asked for in a different shape than the form stores (see interview). */
  extractionOverrides?: Record<string, z.ZodTypeAny>;
  /** Converts what the model returned into what the form stores. */
  coercions?: Record<string, (value: unknown) => unknown>;
  /** Fields whose question goes out alone rather than grouped. */
  askedAlone?: ReadonlySet<string>;

  /** Free-prose fields the plausibility check should never argue with. */
  narrativeKeys?: ReadonlySet<string>;
  /** What the plausibility model may cross-reference beyond the changed fields. */
  plausibilityContextKeys?: string[];
  /** Per-field column subsets that keep the plausibility context small. */
  plausibilityContextParts?: Record<string, string[]>;

  pdf?: PdfOutput;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers over the loose shape                                         */
/* -------------------------------------------------------------------------- */

export function fieldApplies(field: FieldDef, app: AnyApplication): boolean {
  return field.appliesWhen ? field.appliesWhen(app) : true;
}

export function fieldsInSection(def: LicenseDefinition, section: string): FieldDef[] {
  return def.fields.filter((field) => field.section === section);
}

export function fieldByKey(def: LicenseDefinition, key: string): FieldDef | undefined {
  return def.fields.find((field) => field.key === key);
}

export function sectionById(def: LicenseDefinition, id: string): Section {
  const section = def.sections.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown ${def.id} section: ${id}`);
  return section;
}

/** The deferred-fields list, read defensively off a stored draft. */
export function deferredFieldsOf(app: AnyApplication): string[] {
  const value = app.deferredFields;
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [];
}

/**
 * The generic notion of "answered", for forms with no composite fields of
 * their own. Forms with composites (the LPA's source tables and use
 * observations) wrap this with their own cases.
 */
export function defaultFieldAnswered(field: FieldDef, app: AnyApplication): boolean {
  const value = app[field.key];
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return field.emptyListIsAnswer ? true : value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/**
 * Whether the field holds anything worth reading back — a lower bar than being
 * answered, which is what recall and the PDF output want.
 */
export function defaultFieldHasContent(field: FieldDef, app: AnyApplication): boolean {
  const value = app[field.key];
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0 || Boolean(field.emptyListIsAnswer);
  if (typeof value === "object") {
    return Object.values(value).some((part) => part !== null && part !== "");
  }
  return true;
}

/**
 * The meta keys every draft carries alongside its form fields. Defined once so
 * a new form cannot forget one: `pendingConcern` routes a query's answer to the
 * right section, `deferredFields` and `stalledOn` are the loop-breaker, and
 * `externalRequirements` is the applicant's own record of signatures obtained.
 * None of them are on any form schema, so neither extraction nor the review
 * screen's edit path can ever write them.
 */
export function emptyApplicationMeta(): AnyApplication {
  return {
    externalRequirements: {},
    pendingConcern: null,
    deferredFields: [],
    stalledOn: null,
  };
}

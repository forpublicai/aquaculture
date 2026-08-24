/**
 * The controls a review screen can put in front of a field.
 *
 * Moved out of the LPA's editor module when the Experimental lease arrived:
 * the vocabulary of controls is the machine's, and only the assignment of a
 * control to each field belongs to a form. Nothing here knows what a field
 * means, only how a value of its shape is edited.
 */

export interface Choice {
  value: string;
  label: string;
}

/**
 * `record` and `record_list` nest one level and no further, which covers every
 * composite either form has. Nothing here recurses beyond `parts`.
 */
export type Control =
  | { kind: "text" }
  | { kind: "textarea" }
  | { kind: "number"; unit?: string }
  | { kind: "date" }
  | { kind: "boolean" }
  /** One value from a fixed list. */
  | { kind: "choice"; choices: Choice[] }
  /** Any number of values from a fixed list, i.e. the form's checkbox rows. */
  | { kind: "choice_list"; choices: Choice[] }
  /** A list of free-text entries, such as license acronyms or assistant names. */
  | { kind: "text_list"; itemLabel: string }
  /** A single object with named parts, such as one existing-use observation. */
  | { kind: "record"; parts: RecordPart[] }
  /** A repeating table, such as the gear list or the stock list. */
  | { kind: "record_list"; itemLabel: string; parts: RecordPart[] };

export interface RecordPart {
  key: string;
  label: string;
  control: Control;
  /** Shown under the input where the form's wording needs explaining. */
  hint?: string;
  /**
   * True where the underlying schema field is not nullable, so a row without it
   * cannot be saved. Only a handful of parts are: a gear row with no gear named
   * and a landowner row with no owner named are not partial records, they are
   * empty ones.
   */
  required?: boolean;
}

/** Builds dropdown choices from an enum's values and a label map. */
export function choicesFrom(values: readonly string[], labels: Record<string, string>): Choice[] {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

/**
 * A blank entry for a `record` or `record_list` control.
 *
 * Every part starts unanswered, the required ones included. A required choice
 * is deliberately not pre-filled with the first option on its list: the row
 * would read as answered while holding a value nobody chose, and a plausible
 * wrong value looks answered, is never revisited, and goes out on the form. The
 * review screen refuses to save a row until its required parts are filled in, so
 * an unanswered required part arrives as a prompt rather than as an error.
 */
export function emptyEntry(parts: RecordPart[]): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const part of parts) {
    if (!part.required) {
      entry[part.key] = null;
      continue;
    }
    entry[part.key] = part.control.kind === "choice" ? null : "";
  }
  return entry;
}

/**
 * What an empty list should actually be stored as.
 *
 * An empty list is only an answer where the form asks the question that way, so
 * "none of these" stays distinguishable from "never asked". Everywhere else,
 * taking the last entry out means the field goes back to unanswered.
 */
export function normalizeForSave(value: unknown, emptyListIsAnswer: boolean): unknown {
  if (Array.isArray(value) && value.length === 0 && !emptyListIsAnswer) return null;
  return value;
}

/** Required parts left blank, which is what stops a row being saved. */
export function missingRequiredParts(
  parts: RecordPart[],
  entry: Record<string, unknown>
): RecordPart[] {
  return parts.filter((part) => {
    if (!part.required) return false;
    const value = entry[part.key];
    return value === null || value === undefined || String(value).trim() === "";
  });
}

/** Labels for requirement statuses, shared by every form's tracker. */
export const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  not_applicable: "Not applicable",
};

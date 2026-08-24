"use client";

/**
 * The completed application, laid out for review and correction.
 *
 * The memo's flow is: the interview fills the form, then the applicant *reviews
 * and edits* it before anything is produced. This screen is that step, and it
 * is written against a `LicenseDefinition`, so the LPA and the Experimental
 * lease render through the same code: the definition supplies the sections, the
 * fields, the controls, and the checks.
 *
 * Three things are shown together, deliberately not merged:
 *
 * - **The answers**, grouped by the form's own sections and in the form's own
 *   order, every one editable in place.
 * - **The checks**, from the form's validate, shown against the field each one
 *   concerns rather than collected in a list at the bottom. A warning about a
 *   longitude is only useful next to the longitude.
 * - **The requirements**, the drawings, signatures and mailings the app cannot
 *   produce, with the applicant's own record of where each one stands.
 *
 * Fields the applicant's answers have ruled out are not shown at all. A section
 * with nothing applicable in it disappears too, so the page is the form as it
 * applies to this site rather than the form in general.
 *
 * Every edit is one request against one field. There's no draft-and-submit
 * cycle: the interview writes to the same record between messages, so holding a
 * page-wide unsaved copy would mean deciding which of the two wins.
 */
import { useCallback, useState } from "react";

import {
  emptyEntry,
  missingRequiredParts,
  normalizeForSave,
  type Control,
  type RecordPart,
} from "@/lib/application/controls";
import {
  fieldApplies,
  REQUIREMENT_STATUS_CHOICES,
  type AnyApplication,
  type FieldDef,
  type LicenseDefinition,
  type ValidationIssue,
} from "@/lib/application/definition";
import { applicationProgress } from "@/lib/application/progress";
import { definitionForApplication } from "@/lib/application/registry";
import { applicableRequirements } from "@/lib/application/requirements";
import { HAIRLINE, MUTED } from "@/components/theme";

/** One edit, in the shape `/api/application` accepts. */
type Edit =
  | { type: "field"; key: string; value: unknown }
  | { type: "requirement"; id: string; status: string };

/** Sends one edit and hands back the saved application, or throws with the reason. */
async function sendEdit(conversationId: string, edit: Edit): Promise<AnyApplication> {
  const res = await fetch("/api/application", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, edit }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "That change could not be saved.");
  return data.application as AnyApplication;
}

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                         */
/* -------------------------------------------------------------------------- */

const INPUT_CLASS = "w-full rounded border px-2 py-1.5 text-sm outline-none";

function inputStyle(): React.CSSProperties {
  return { borderColor: HAIRLINE, fontFamily: "var(--font-sans)", background: "transparent" };
}

function MiniButton({
  onClick,
  children,
  disabled,
  emphasis,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  emphasis?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-full border px-3 py-1 text-xs disabled:opacity-40"
      style={{
        borderColor: HAIRLINE,
        color: emphasis ? undefined : MUTED,
        fontWeight: emphasis ? 600 : 400,
        background: emphasis ? "var(--surface-subtle)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

function IssueLine({ issue }: { issue: ValidationIssue }) {
  return (
    <p className="mt-1 text-xs" style={{ color: MUTED }}>
      {issue.severity === "blocking" ? "🛑" : "⚠️"} {issue.message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Renders one control for one value. Knows nothing about saving: it reports a
 * new value upward and the row that owns it decides what to do with that.
 *
 * An empty text box reports null rather than the empty string, so "I deleted
 * what was in here" and "this was never answered" end up as the same stored
 * value. The alternative is a form field holding "" that reads as answered
 * everywhere else in the app.
 */
function ControlInput({
  control,
  value,
  onChange,
  allowsEmptyList,
}: {
  control: Control;
  value: unknown;
  onChange: (next: unknown) => void;
  allowsEmptyList?: boolean;
}) {
  switch (control.kind) {
    case "text":
    case "date":
      return (
        <input
          type={control.kind === "date" ? "date" : "text"}
          className={INPUT_CLASS}
          style={inputStyle()}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );

    case "textarea":
      return (
        <textarea
          rows={3}
          className={INPUT_CLASS}
          style={inputStyle()}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        />
      );

    case "number":
      return (
        <span className="flex items-center gap-2">
          <input
            type="number"
            className={INPUT_CLASS}
            style={inputStyle()}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => {
              // A number input reports "" for anything it can't parse, including
              // a lone minus sign mid-typing, so an empty box is the only case
              // to special-case; Number("") is 0, which would silently record a
              // zero the applicant never typed.
              const raw = e.target.value;
              onChange(raw === "" ? null : Number(raw));
            }}
          />
          {control.unit && (
            <span className="shrink-0 text-xs" style={{ color: MUTED }}>
              {control.unit}
            </span>
          )}
        </span>
      );

    case "boolean":
      return (
        <span className="flex gap-2">
          {[
            { label: "Yes", on: true },
            { label: "No", on: false },
          ].map(({ label, on }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(on)}
              className="rounded-full border px-4 py-1 text-xs"
              style={{
                borderColor: HAIRLINE,
                fontWeight: value === on ? 600 : 400,
                background: value === on ? "var(--surface-subtle)" : undefined,
                color: value === on ? undefined : MUTED,
              }}
            >
              {label}
            </button>
          ))}
        </span>
      );

    case "choice":
      return (
        <select
          className={INPUT_CLASS}
          style={inputStyle()}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Not answered</option>
          {control.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      );

    case "choice_list": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <span className="flex flex-col gap-1.5">
          {control.choices.map((choice) => {
            const on = selected.includes(choice.value);
            return (
              <label key={choice.value} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  className="mt-0.5"
                  onChange={() =>
                    onChange(
                      on
                        ? selected.filter((entry) => entry !== choice.value)
                        : [...selected, choice.value]
                    )
                  }
                />
                <span>{choice.label}</span>
              </label>
            );
          })}
        </span>
      );
    }

    case "text_list": {
      const entries = Array.isArray(value) ? (value as string[]) : null;
      if (entries === null) {
        return (
          <span className="flex gap-2">
            <MiniButton onClick={() => onChange([""])}>Add {control.itemLabel}</MiniButton>
            {allowsEmptyList && (
              <MiniButton onClick={() => onChange([])} title="Record that there are none">
                None
              </MiniButton>
            )}
          </span>
        );
      }
      return (
        <span className="flex flex-col gap-1.5">
          {entries.map((entry, index) => (
            <span key={index} className="flex items-center gap-2">
              <input
                type="text"
                className={INPUT_CLASS}
                style={inputStyle()}
                value={entry ?? ""}
                onChange={(e) => {
                  const next = [...entries];
                  next[index] = e.target.value;
                  onChange(next);
                }}
              />
              <MiniButton
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
                title="Remove"
              >
                ✕
              </MiniButton>
            </span>
          ))}
          <span>
            <MiniButton onClick={() => onChange([...entries, ""])}>
              Add {control.itemLabel}
            </MiniButton>
          </span>
        </span>
      );
    }

    case "record": {
      const entry = (value ?? null) as Record<string, unknown> | null;
      if (entry === null) {
        return <MiniButton onClick={() => onChange(emptyEntry(control.parts))}>Fill this in</MiniButton>;
      }
      return (
        <RecordParts
          parts={control.parts}
          entry={entry}
          onChange={(next) => onChange(next)}
        />
      );
    }

    case "record_list": {
      const entries = Array.isArray(value) ? (value as Record<string, unknown>[]) : null;
      // An empty list and no list at all are different answers for the stock
      // lists: "I'm not taking anything from the wild" is a real answer the form
      // asks for, and it has to be distinguishable from never having been asked.
      if (entries === null) {
        return (
          <span className="flex gap-2">
            <MiniButton onClick={() => onChange([emptyEntry(control.parts)])}>
              Add {control.itemLabel}
            </MiniButton>
            {allowsEmptyList && (
              <MiniButton onClick={() => onChange([])} title="Record that there are none">
                None
              </MiniButton>
            )}
          </span>
        );
      }
      return (
        <span className="flex flex-col gap-3">
          {entries.length === 0 && (
            <span className="text-sm italic" style={{ color: MUTED }}>
              Recorded as none.
            </span>
          )}
          {entries.map((entry, index) => (
            <span
              key={index}
              className="flex flex-col gap-2 rounded border p-3"
              style={{ borderColor: HAIRLINE }}
            >
              <span className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: MUTED }}>
                  {control.itemLabel} {index + 1}
                </span>
                <MiniButton
                  onClick={() => onChange(entries.filter((_, i) => i !== index))}
                  title="Remove this entry"
                >
                  Remove
                </MiniButton>
              </span>
              <RecordParts
                parts={control.parts}
                entry={entry}
                onChange={(next) => {
                  const updated = [...entries];
                  updated[index] = next;
                  onChange(updated);
                }}
              />
            </span>
          ))}
          <span>
            <MiniButton onClick={() => onChange([...entries, emptyEntry(control.parts)])}>
              Add {control.itemLabel}
            </MiniButton>
          </span>
        </span>
      );
    }
  }
}

/** The named parts of one composite entry. */
function RecordParts({
  parts,
  entry,
  onChange,
}: {
  parts: RecordPart[];
  entry: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <span className="flex flex-col gap-2">
      {parts.map((part) => (
        <span key={part.key} className="flex flex-col gap-1">
          <span className="text-xs font-semibold">
            {part.label}
            {part.required && <span style={{ color: MUTED }}> (required)</span>}
          </span>
          <ControlInput
            control={part.control}
            value={entry[part.key] ?? null}
            onChange={(next) => onChange({ ...entry, [part.key]: next })}
          />
          {part.hint && (
            <span className="text-xs" style={{ color: MUTED }}>
              {part.hint}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* One field                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A field, its control, and its save state.
 *
 * Discrete controls (yes/no, a dropdown) save the moment they change: picking
 * an option is already a deliberate act, and asking for a second click to
 * confirm it reads as a bug. Everything typed or built up entry by entry saves
 * on an explicit Save, which only appears once the draft differs from what's
 * stored, so a half-typed address is never written.
 */
function FieldRow({
  definition,
  field,
  application,
  issues,
  conversationId,
  onSaved,
}: {
  definition: LicenseDefinition;
  field: FieldDef;
  application: AnyApplication;
  issues: ValidationIssue[];
  conversationId: string;
  onSaved: (application: AnyApplication) => void;
}) {
  const control = definition.editors[field.key];
  const stored = application[field.key] ?? null;
  // Compared as JSON rather than by reference: every save replaces the whole
  // application object, so a reference check would reset every other row's
  // in-progress draft on each write.
  const storedJson = JSON.stringify(stored);

  const [draft, setDraft] = useState<unknown>(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the stored value changes underneath us, the draft has to follow: the
  // interview writes to the same record between chat messages, so a field can
  // be answered in conversation while this screen is open.
  //
  // This is React's "adjusting state when a prop changes" pattern, done during
  // render rather than in an effect on purpose. An effect would render once
  // with the stale draft, then again with the new one, and the lint rule
  // against setState in an effect exists to catch exactly that.
  // https://react.dev/learn/you-might-not-need-an-effect
  const [syncedJson, setSyncedJson] = useState(storedJson);
  if (syncedJson !== storedJson) {
    setSyncedJson(storedJson);
    setDraft(JSON.parse(storedJson));
    setError(null);
  }

  const save = useCallback(
    async (value: unknown) => {
      setSaving(true);
      setError(null);
      try {
        const toStore = normalizeForSave(value, Boolean(field.emptyListIsAnswer));
        onSaved(await sendEdit(conversationId, { type: "field", key: field.key, value: toStore }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "That change could not be saved.");
      } finally {
        setSaving(false);
      }
    },
    [conversationId, field, onSaved]
  );

  if (!control) return null;

  const savesOnChange = control.kind === "boolean" || control.kind === "choice";
  // A dropdown carries its own "Not answered" option, so it needs no Clear
  // button. Every other control needs one, yes/no included: this screen is the
  // only path in the app that can remove an answer, because a null from the
  // extraction model means "not mentioned" and never "erased", and a pair of
  // buttons has no third state to click.
  const clearsInControl = control.kind === "choice";
  const dirty = JSON.stringify(draft ?? null) !== storedJson;
  const answered = definition.fieldAnswered(field, application);

  // A row holding a blank where the form needs a value can't be saved. Blocked
  // here rather than at the route so the message names what is missing, and
  // blocked rather than quietly dropped so nothing the applicant typed vanishes
  // on a click. Labels are deduplicated, or two unfinished gear rows would ask
  // for the gear item twice.
  const blocker: string | null = (() => {
    const naming = (parts: RecordPart[]) => {
      const labels = [...new Set(parts.map((part) => part.label.toLowerCase()))];
      return labels.length === 0 ? null : `Fill in ${labels.join(" and ")} before saving.`;
    };

    if (control.kind === "text_list" && Array.isArray(draft)) {
      const blank = (draft as (string | null)[]).some((entry) => (entry ?? "").trim() === "");
      return blank ? `Fill in or remove the empty ${control.itemLabel.toLowerCase()}.` : null;
    }
    if (control.kind === "record" && draft) {
      return naming(missingRequiredParts(control.parts, draft as Record<string, unknown>));
    }
    if (control.kind === "record_list" && Array.isArray(draft)) {
      return naming(
        (draft as Record<string, unknown>[]).flatMap((entry) =>
          missingRequiredParts(control.parts, entry)
        )
      );
    }
    return null;
  })();

  return (
    <div className="py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">
          {field.label}
          {!answered && (
            <span className="ml-2 text-xs font-normal italic" style={{ color: MUTED }}>
              not answered
            </span>
          )}
        </span>
        {answered && !clearsInControl && (
          <MiniButton
            onClick={() => save(null)}
            disabled={saving}
            title="Remove this answer entirely"
          >
            Clear
          </MiniButton>
        )}
      </div>

      <ControlInput
        control={control}
        value={draft}
        allowsEmptyList={field.emptyListIsAnswer}
        onChange={(next) => {
          setDraft(next);
          if (savesOnChange) void save(next);
        }}
      />

      {field.hint && (
        <p className="mt-1 text-xs" style={{ color: MUTED }}>
          {field.hint}
        </p>
      )}

      {issues.map((issue, i) => (
        <IssueLine key={i} issue={issue} />
      ))}

      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-brand, #EF3C24)" }}>
          {error}
        </p>
      )}

      {blocker && (
        <p className="mt-1 text-xs" style={{ color: MUTED }}>
          {blocker}
        </p>
      )}

      {!savesOnChange && dirty && (
        <div className="mt-2 flex items-center gap-2">
          <MiniButton
            onClick={() => void save(draft)}
            disabled={saving || blocker !== null}
            emphasis
          >
            {saving ? "Saving..." : "Save"}
          </MiniButton>
          <MiniButton onClick={() => setDraft(JSON.parse(storedJson))} disabled={saving}>
            Undo
          </MiniButton>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections and requirements                                                   */
/* -------------------------------------------------------------------------- */

function SectionBlock({
  definition,
  sectionId,
  application,
  issuesByField,
  conversationId,
  onSaved,
}: {
  definition: LicenseDefinition;
  sectionId: string;
  application: AnyApplication;
  issuesByField: Map<string, ValidationIssue[]>;
  conversationId: string;
  onSaved: (application: AnyApplication) => void;
}) {
  const [open, setOpen] = useState(true);
  const section = definition.sections.find((candidate) => candidate.id === sectionId);
  const fields = definition.fields.filter(
    (field) => field.section === sectionId && fieldApplies(field, application)
  );
  if (!section || fields.length === 0) return null;

  const answered = fields.filter((field) => definition.fieldAnswered(field, application)).length;

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span>
          <span
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-ui)" }}
          >
            {section.title}
          </span>
          <span className="ml-2 text-xs" style={{ color: MUTED }}>
            {section.blurb}
          </span>
        </span>
        <span className="shrink-0 tabular-nums text-xs" style={{ color: MUTED }}>
          {answered}/{fields.length} {open ? "▾" : "▸"}
        </span>
      </button>

      {open &&
        fields.map((field) => (
          <FieldRow
            key={field.key}
            definition={definition}
            field={field}
            application={application}
            issues={issuesByField.get(field.key) ?? []}
            conversationId={conversationId}
            onSaved={onSaved}
          />
        ))}
    </section>
  );
}

/**
 * The things the app can't produce. Status is the applicant's own record: the
 * app has no way to know whether a harbormaster has signed anything, so nothing
 * here is ever inferred, only chosen.
 */
function RequirementsBlock({
  definition,
  application,
  conversationId,
  onSaved,
}: {
  definition: LicenseDefinition;
  application: AnyApplication;
  conversationId: string;
  onSaved: (application: AnyApplication) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requirements = applicableRequirements(definition, application);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    setError(null);
    try {
      onSaved(await sendEdit(conversationId, { type: "requirement", id, status }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6">
      <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-ui)" }}>
        Documents, signatures and payment
      </h2>
      <p className="mt-1 text-xs" style={{ color: MUTED }}>
        These are the parts of the application I can&apos;t produce for you. Track them here as you
        get them.
      </p>

      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-brand, #EF3C24)" }}>
          {error}
        </p>
      )}

      {requirements.map((requirement) => (
        <div key={requirement.id} className="py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">{requirement.label}</span>
            <select
              className="shrink-0 rounded border px-2 py-1 text-xs"
              style={inputStyle()}
              value={requirement.status}
              disabled={busy === requirement.id}
              onChange={(e) => void setStatus(requirement.id, e.target.value)}
            >
              {REQUIREMENT_STATUS_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs" style={{ color: MUTED }}>
            {requirement.detail}
          </p>
        </div>
      ))}
    </section>
  );
}

/**
 * Producing the application as DMR's own form.
 *
 * The download is DMR's PDF with the answers drawn onto it — or, for a form
 * whose coordinate map hasn't been measured yet, the untouched official form
 * followed by labeled continuation sheets carrying every answer. Either way it
 * is DMR's own document: an applicant mailing DMR something that is not DMR's
 * form is a good way to have an application returned.
 *
 * An incomplete application still downloads, watermarked. Refusing would be
 * worse: people reasonably want to see the form filled in as far as it goes,
 * print it, and finish it by hand.
 */
function DownloadForm({
  definition,
  conversationId,
  incomplete,
}: {
  definition: LicenseDefinition;
  conversationId: string;
  incomplete: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdf = definition.pdf;
  if (!pdf) return null;

  const mapped = Boolean(pdf.mapFile);

  async function download() {
    if (!pdf) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/application/pdf?conversationId=${conversationId}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        res.headers.get("X-Draft") === "true"
          ? `${pdf.downloadName}-DRAFT.pdf`
          : `${pdf.downloadName}.pdf`;
      link.click();
      // Revoked on the next tick: revoking synchronously can beat the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  const description = mapped
    ? incomplete
      ? "Your answers, written onto DMR's own form. It isn't finished, so every page comes out marked DRAFT. Anything too long for its box goes on a continuation sheet at the end."
      : "Your answers, written onto DMR's own form, ready to print and sign. Anything too long for its box goes on a continuation sheet at the end."
    : "DMR's official form, followed by continuation sheets carrying every answer you've given, labeled with the form's own field names. Copy them into the form's boxes, or submit the sheets alongside it.";

  return (
    <section className="mb-6 rounded p-4" style={{ background: "var(--surface-subtle)" }}>
      <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-ui)" }}>
        Download the application
      </h2>
      <p className="mb-3 mt-1 text-xs" style={{ color: MUTED }}>
        {description}
      </p>
      <MiniButton onClick={() => void download()} disabled={busy} emphasis>
        {busy ? "Preparing..." : incomplete ? "Download draft (PDF)" : "Download the form (PDF)"}
      </MiniButton>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-brand, #EF3C24)" }}>
          {error}
        </p>
      )}
      <p className="mt-3 text-xs" style={{ color: MUTED }}>
        Check every page against DMR&apos;s instructions before you send it. The signatures,
        drawings and the fee are still yours to add.
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The screen                                                                  */
/* -------------------------------------------------------------------------- */

export function ApplicationReview({
  application,
  conversationId,
  onChange,
}: {
  application: AnyApplication;
  conversationId: string;
  onChange: (application: AnyApplication) => void;
}) {
  const definition = definitionForApplication(application);
  const progress = applicationProgress(definition, application);
  const issues = definition.validate(application);

  // Issues carrying a field key are shown against that field. The rest, if any
  // ever exist, are shown at the top so nothing is silently dropped.
  const issuesByField = new Map<string, ValidationIssue[]>();
  const unattached: ValidationIssue[] = [];
  for (const issue of issues) {
    if (!issue.field) {
      unattached.push(issue);
      continue;
    }
    issuesByField.set(issue.field, [...(issuesByField.get(issue.field) ?? []), issue]);
  }

  const blocking = issues.filter((issue) => issue.severity === "blocking");

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold">
          {progress.answered} of {progress.applicable} questions answered
        </span>
        <span style={{ color: MUTED }}>{progress.percent}%</span>
      </div>
      <div
        className="mb-4 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-subtle)" }}
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress.percent}%`, background: "var(--pai-black)" }}
        />
      </div>

      <p className="mb-6 text-xs" style={{ color: MUTED }}>
        Everything you&apos;ve told me, in the order the printed form asks for it. Correct anything
        that&apos;s wrong and it&apos;s saved as you go. Questions your answers have already ruled
        out aren&apos;t shown.
      </p>

      {blocking.length > 0 && (
        <div className="mb-6 rounded p-3" style={{ background: "var(--surface-subtle)" }}>
          <p className="mb-1 text-xs font-semibold">
            {blocking.length === 1
              ? "One thing would stop this application"
              : `${blocking.length} things would stop this application`}
          </p>
          {blocking.map((issue, i) => (
            <IssueLine key={i} issue={issue} />
          ))}
        </div>
      )}

      {unattached.map((issue, i) => (
        <IssueLine key={i} issue={issue} />
      ))}

      {progress.sections.map((section) => (
        <SectionBlock
          key={section.id}
          definition={definition}
          sectionId={section.id}
          application={application}
          issuesByField={issuesByField}
          conversationId={conversationId}
          onSaved={onChange}
        />
      ))}

      <RequirementsBlock
        definition={definition}
        application={application}
        conversationId={conversationId}
        onSaved={onChange}
      />

      <DownloadForm
        definition={definition}
        conversationId={conversationId}
        incomplete={progress.answered < progress.applicable || blocking.length > 0}
      />

      <p className="pb-6 text-xs" style={{ color: MUTED }}>
        This is a draft prepared from what you&apos;ve told me, not legal advice. Check it against
        the current form and DMR&apos;s guidance before you send it.
      </p>
    </div>
  );
}

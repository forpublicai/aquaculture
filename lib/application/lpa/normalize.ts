/**
 * Bringing a stored application into the shape the rest of the app expects.
 *
 * Two jobs live here because they are the same job at different distances. One
 * reads a draft written before the species list existed and rewrites it in the
 * current shape. The other reacts to a species being named by opening the row
 * its source belongs in. Both are pure, both are idempotent, and both exist so
 * that no other file has to know that the shape ever changed.
 *
 * Everything here reads defensively. The values arrive from a model, round-trip
 * through JSONB, and may have been written by a version of this code that no
 * longer exists, so nothing trusts the schema's shape at runtime.
 */
import {
  HatcherySourceSchema,
  LpaApplicationSchema,
  soleTableFor,
  WildSourceSchema,
  EMPTY_LPA_APPLICATION,
  type LpaApplication,
} from "./schema";

type Row = Record<string, unknown>;

const USE_OBSERVATION_KEYS = [
  "commercialFishingUse",
  "recreationalFishingUse",
  "boatingUse",
  "otherWaterUse",
] as const;

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => !!row && typeof row === "object") : [];
}

function speciesOf(row: Row): string | null {
  return typeof row.species === "string" ? row.species : null;
}

/**
 * A blank row for one table, built from the schema's own keys so that adding a
 * column to a source can't leave this behind holding the old set.
 */
function blankRow(table: "hatchery" | "wild", species: string): Row {
  const shape = table === "hatchery" ? HatcherySourceSchema.shape : WildSourceSchema.shape;
  return Object.fromEntries(
    Object.keys(shape).map((key) => [key, key === "species" ? species : null])
  );
}

/* -------------------------------------------------------------------------- */
/* Opening the row a new species needs                                         */
/* -------------------------------------------------------------------------- */

/**
 * Opens a waiting source row for each species just named, where the form leaves
 * no choice about which table it belongs in.
 *
 * Most species are printed on one of the two tables only, so naming one also
 * places it: say "quahogs" and the hatchery table is the sole possibility, and
 * the applicant should be looking at a row asking which hatchery rather than
 * retyping the species. Blue mussel, American oyster and green sea urchin are
 * printed on both, so they are left alone and asked about.
 *
 * **Only species newly added are seeded**, which is why this takes the previous
 * application as well as the next. Seeding from the current list alone would
 * re-open a row the applicant had just deleted, and a row that comes back when
 * you remove it reads as a bug however defensible the reasoning. Removing the
 * row and keeping the species is a real state: it means the source is not known
 * yet, and the missing source is reported as a warning rather than repaired.
 */
export function seedSourceRows(previous: LpaApplication, next: LpaApplication): LpaApplication {
  // Widened to string on the way in. These values come back from storage and
  // from a model, so the enum the type claims is a hope, not a guarantee.
  const before = new Set<string>(Array.isArray(previous.species) ? previous.species : []);
  const chosen: string[] = Array.isArray(next.species) ? (next.species as string[]) : [];
  const added = chosen.filter((species) => typeof species === "string" && !before.has(species));
  if (added.length === 0) return next;

  const seeded: LpaApplication = { ...next };
  for (const table of ["hatchery", "wild"] as const) {
    const key = table === "hatchery" ? "hatcherySources" : "wildSources";
    const wanted = added.filter((species) => soleTableFor(species) === table);
    if (wanted.length === 0) continue;

    const rows = rowsOf(seeded[key]);
    const present = new Set(rows.map(speciesOf).filter((name): name is string => name !== null));
    const opened = wanted.filter((species) => !present.has(species));
    if (opened.length === 0) continue;

    (seeded as Record<string, unknown>)[key] = [
      ...rows,
      ...opened.map((species) => blankRow(table, species)),
    ];
  }
  return seeded;
}

/* -------------------------------------------------------------------------- */
/* Reading a draft written in an older shape                                   */
/* -------------------------------------------------------------------------- */

/**
 * Species and source used to be one record: `hatcheryStock` and `wildStock` held
 * rows carrying a species, a note, and the source columns together. Splitting
 * them left every draft written before the split unreadable, since the species
 * list the app now works from did not exist.
 *
 * The conversion is exact. Each old row contributes its species to the species
 * list and its source columns to the matching table, so a draft that named three
 * species and one hatchery still names three species and one hatchery. Nothing
 * is inferred and nothing is dropped except the per-row species note, which
 * becomes the form's write-in for Other or for marine algae, where it belongs.
 */
function convertLegacyStock(raw: Row, into: LpaApplication): LpaApplication {
  const species: string[] = Array.isArray(into.species) ? [...into.species] : [];
  const converted: LpaApplication = { ...into };

  for (const [legacyKey, table] of [
    ["hatcheryStock", "hatchery"],
    ["wildStock", "wild"],
  ] as const) {
    const rows = rowsOf(raw[legacyKey]);
    if (rows.length === 0 && raw[legacyKey] === undefined) continue;

    const key = table === "hatchery" ? "hatcherySources" : "wildSources";
    const carried: Row[] = [];
    for (const row of rows) {
      const name = speciesOf(row);
      if (name === null) continue;
      if (!species.includes(name)) species.push(name);

      const note = typeof row.speciesNote === "string" ? row.speciesNote.trim() : "";
      if (note !== "") {
        // The note used to hang off the row. On the form it is the write-in on
        // the "Other" line or the "Marine Algae" line, so that is where it goes.
        if (name === "other" && !converted.otherSpeciesNote) converted.otherSpeciesNote = note;
        if (name === "marine_algae" && !converted.marineAlgaeNote) converted.marineAlgaeNote = note;
      }

      const target = blankRow(table, name);
      for (const column of Object.keys(target)) {
        if (column === "species") continue;
        if (row[column] !== undefined) target[column] = row[column];
      }
      carried.push(target);
    }
    (converted as Record<string, unknown>)[key] = carried;
  }

  // Written through the record view: the list is built from stored values, so it
  // is string[] here, and narrowing it to the enum would be a claim this
  // function is in no position to make. The parse at the end is what checks it.
  (converted as Record<string, unknown>).species = species.length > 0 ? species : null;
  return converted;
}

/**
 * Reads whatever is stored against a conversation and hands back a current
 * application, or null if there isn't one.
 *
 * Keys the form no longer has are dropped rather than carried along, because
 * every save spreads the whole object and a stale key would otherwise outlive
 * the field forever, eventually printing onto a document nobody meant it to.
 * Keys the form has gained arrive unanswered.
 *
 * A draft that fails to parse afterwards is still returned. It is the
 * applicant's work, the rest of the app already reads these values defensively,
 * and discarding a conversation because one value drifted would be a far worse
 * outcome than showing it back with one field unanswered.
 */
export function migrateApplication(stored: unknown): LpaApplication | null {
  if (!stored || typeof stored !== "object") return null;
  const raw = stored as Row;

  const known = new Set(Object.keys(LpaApplicationSchema.shape));
  let application: LpaApplication = { ...EMPTY_LPA_APPLICATION };
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) continue;
    (application as Record<string, unknown>)[key] = value;
  }

  // The old shape is recognized by what it has, not by what it lacks, so a draft
  // already converted passes through untouched however many times it is loaded.
  if (raw.hatcheryStock !== undefined || raw.wildStock !== undefined) {
    application = convertLegacyStock(raw, application);
  }

  // Use observations gained an "occurs" part, so that "none observed" could be
  // recorded at all. A record written before that has boxes filled and no
  // `occurs`, which plainly means the use does happen.
  for (const key of USE_OBSERVATION_KEYS) {
    const observation = application[key] as Record<string, unknown> | null;
    if (!observation || typeof observation !== "object") continue;
    if (observation.occurs !== undefined) continue;
    const described = Object.values(observation).some(
      (part) => typeof part === "string" && part.trim() !== ""
    );
    (application as Record<string, unknown>)[key] = { ...observation, occurs: described || null };
  }

  const parsed = LpaApplicationSchema.safeParse(application);
  if (parsed.success) return parsed.data;

  console.warn(
    "[lpa] stored application did not match the current form:",
    parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`)
  );
  return application;
}

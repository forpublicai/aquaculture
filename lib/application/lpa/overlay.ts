/**
 * Drawing the applicant's answers onto DMR's own LPA application form.
 *
 * The alternative was generating a document that mirrors the form. That would be
 * easier and it would be wrong: an applicant would be mailing DMR something that
 * is not DMR's form, which is a good way to have an application returned. So the
 * output is the official PDF, unaltered except for the answers written into it.
 *
 * The form has no fillable fields, so every answer is drawn at a coordinate.
 * Those coordinates live in `data/lpa-overlay-map.json`, worked out from the
 * form's own table rules and checkbox glyphs by `scripts/build-overlay-map.py`.
 * Nothing here measures anything.
 *
 * **Nothing is ever silently dropped.** An answer the map has no home for, or one
 * too long for its box, is written onto a continuation sheet appended after the
 * form, and the box on the form says where to look. An application that leaves
 * something out is worse than one that runs to an extra page: the form is denied
 * for incompleteness and the fee is forfeited.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { fieldApplies, fieldHasContent, LPA_FIELDS, type LpaFieldDef } from "./fields";
import { applicationProgress, validateApplication } from "./progress";
import { describeField } from "./recall";
import type { LpaApplication, LpaFormKey } from "./schema";

/** One rectangle on one page, in the coordinates pdfplumber reports. */
interface Placement {
  page: number;
  /** [x0, top, x1, bottom], measured from the top-left of the page. */
  rect: [number, number, number, number];
}

export interface OverlayMap {
  form: string;
  revision: string;
  page: { width: number; height: number };
  fields: Record<string, Placement>;
  checkboxes: Record<string, Placement>;
}

export interface FilledForm {
  bytes: Uint8Array;
  /** Answers that went to a continuation sheet rather than onto the form. */
  continued: string[];
  /** True when the form carries a draft watermark. */
  draft: boolean;
}

const INK = rgb(0.05, 0.1, 0.45); // Blue-black, so a filled field reads as filled in.
const MIN_SIZE = 7; // DMR asks for legible applications. Below this, use a sheet.
const MAX_SIZE = 10;
const PAD = 3;

/* -------------------------------------------------------------------------- */
/* Text fitting                                                               */
/* -------------------------------------------------------------------------- */

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * The largest legible size at which the text fits the box, or null if there
 * isn't one. Null is not a failure: it routes the answer to a continuation
 * sheet, which is what the form's own instructions expect for a long answer.
 */
function fit(
  text: string,
  font: PDFFont,
  width: number,
  height: number
): { size: number; lines: string[] } | null {
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 0.5) {
    const lines = wrap(text, font, size, width);
    const tallest = lines.reduce(
      (widest, line) => Math.max(widest, font.widthOfTextAtSize(line, size)),
      0
    );
    if (tallest <= width && lines.length * size * 1.15 <= height) return { size, lines };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* What goes where                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The checkbox keys that should be ticked.
 *
 * A key is `field.option`. Most resolve against the field's own value, but the
 * form's three species-and-feature tables tick a box per *row*, so those are
 * read out of their lists by name.
 */
function ticked(app: LpaApplication, keys: string[]): Set<string> {
  const rows = (value: unknown, member: string): string[] =>
    Array.isArray(value)
      ? value
          .map((row) => (row as Record<string, unknown> | null)?.[member])
          .filter((name): name is string => typeof name === "string")
      : [];

  const listed: Record<string, string[]> = {
    hatcherySpecies: rows(app.hatcherySources, "species"),
    wildSpecies: rows(app.wildSources, "species"),
    nearbyFeatures: rows(app.nearbyFeatures, "feature"),
  };

  const on = new Set<string>();
  for (const key of keys) {
    const cut = key.lastIndexOf(".");
    const field = key.slice(0, cut);
    const option = key.slice(cut + 1);

    if (field in listed) {
      if (listed[field].includes(option)) on.add(key);
      continue;
    }
    const value = (app as Record<string, unknown>)[field];
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (String(value) === option) on.add(key);
    } else if (Array.isArray(value)) {
      if (value.includes(option)) on.add(key);
    } else if (String(value) === option) {
      on.add(key);
    }
  }
  return on;
}

/** Every answer the applicant has given, in the form's order. */
function answered(app: LpaApplication): LpaFieldDef[] {
  return LPA_FIELDS.filter((field) => fieldApplies(field, app) && fieldHasContent(field, app));
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

function draw(page: PDFPage, lines: string[], size: number, x: number, top: number, font: PDFFont) {
  const height = page.getHeight();
  lines.forEach((line, index) => {
    // pdfplumber measures from the top of the page and pdf-lib from the bottom,
    // and the y it wants is the baseline, not the top of the glyphs.
    page.drawText(line, {
      x,
      y: height - (top + size * 0.85 + index * size * 1.15),
      size,
      font,
      color: INK,
    });
  });
}

function watermark(page: PDFPage, font: PDFFont) {
  const { width, height } = page.getSize();
  page.drawText("DRAFT - NOT FOR SUBMISSION", {
    x: width * 0.08,
    y: height * 0.42,
    size: 34,
    font,
    color: rgb(0.85, 0.3, 0.2),
    rotate: { type: "degrees", angle: 30 } as never,
    opacity: 0.22,
  });
}

/* -------------------------------------------------------------------------- */
/* The form                                                                   */
/* -------------------------------------------------------------------------- */

export async function fillLpaForm(
  formPdf: Uint8Array | ArrayBuffer,
  map: OverlayMap,
  app: LpaApplication
): Promise<FilledForm> {
  const pdf = await PDFDocument.load(formPdf);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  const progress = applicationProgress(app);
  const blocking = validateApplication(app).filter((issue) => issue.severity === "blocking");
  const draft = progress.answered < progress.applicable || blocking.length > 0;

  // Sheets are numbered as they are claimed, so the note in the box and the
  // heading on the sheet always agree.
  const sheets: { heading: string; body: string }[] = [];
  const claim = (heading: string, body: string) => {
    sheets.push({ heading, body });
    return sheets.length;
  };

  const given = answered(app);
  const placed = new Set<string>();

  for (const field of given) {
    const placement = map.fields[field.key];
    const text = describeField(field.key as LpaFormKey, app).trim();
    if (!text) continue;

    if (!placement) continue; // Handled below, with everything else off the map.
    placed.add(field.key);

    const page = pages[placement.page];
    const [x0, top, x1, bottom] = placement.rect;
    const width = x1 - x0 - PAD * 2;
    const height = bottom - top - PAD;

    const fitted = fit(text, font, width, height);
    if (fitted) {
      draw(page, fitted.lines, fitted.size, x0 + PAD, top + PAD, font);
      continue;
    }
    const sheet = claim(field.label, text);
    const note = fit(`See continuation sheet ${sheet}`, font, width, height);
    if (note) draw(page, note.lines, note.size, x0 + PAD, top + PAD, font);
  }

  // The rectangle here is the square as actually drawn on the form, measured off
  // a render rather than taken from the checkbox character's own metrics, which
  // are nowhere near its ink. Centring on it is therefore just arithmetic.
  for (const key of ticked(app, Object.keys(map.checkboxes))) {
    const { page: index, rect } = map.checkboxes[key];
    const [x0, top, x1, bottom] = rect;
    const size = (bottom - top) * 1.15;
    const page = pages[index];
    page.drawText("X", {
      x: x0 + (x1 - x0) * 0.18,
      y: page.getHeight() - ((top + bottom) / 2 + size * 0.36),
      size,
      font: bold,
      color: INK,
    });
  }

  // Everything the map has no home for. The map covers the form's single-value
  // boxes and every checkbox; its repeating tables are not placed yet, and an
  // answer with nowhere to go must still reach DMR.
  const offMap = given.filter((field) => !placed.has(field.key) && !map.fields[field.key]);
  for (const field of offMap) {
    const text = describeField(field.key as LpaFormKey, app).trim();
    if (text) claim(field.label, text);
  }

  for (const [index, sheet] of sheets.entries()) {
    const page = pdf.addPage([map.page.width, map.page.height]);
    draw(page, [`CONTINUATION SHEET ${index + 1}`], 13, 54, 54, bold);
    draw(page, [sheet.heading], 11, 54, 78, bold);
    const body = fit(sheet.body, font, map.page.width - 108, map.page.height - 160);
    if (body) draw(page, body.lines, body.size, 54, 104, font);
    else draw(page, wrap(sheet.body, font, MIN_SIZE, map.page.width - 108), MIN_SIZE, 54, 104, font);
  }

  if (draft) for (const page of pdf.getPages()) watermark(page, bold);

  return {
    bytes: await pdf.save(),
    continued: sheets.map((sheet) => sheet.heading),
    draft,
  };
}

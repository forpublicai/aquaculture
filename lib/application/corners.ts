/**
 * The corner-coordinate table, in the shape the model answers in.
 *
 * Three of the four forms in this app (the Experimental lease and both Standard
 * lease applications) ask for the site's corners in decimal degrees, NW corner
 * first, clockwise. Applicants read corners off a chartplotter as degrees,
 * minutes and seconds, so each coordinate is widened to accept their exact
 * wording and converted in code, where the arithmetic can be read and tested —
 * the same treatment as the LPA's single center point, per row. The model is
 * told not to convert, because a model doing sums silently is the thing this
 * codebase keeps deciding not to trust.
 */
import { z } from "zod";

import { parseCoordinate } from "./coordinates";

export const cornersExtractionShape = z
  .array(
    z.object({
      latitude: z
        .union([z.number(), z.string()])
        .nullable()
        .describe(
          "This corner's latitude. A number if the applicant gave decimal " +
            "degrees; otherwise their wording exactly as a string, and it will " +
            "be converted. Do not do the conversion yourself."
        ),
      longitude: z
        .union([z.number(), z.string()])
        .nullable()
        .describe(
          "This corner's longitude, negative for west if already a number; " +
            "otherwise their wording exactly as a string."
        ),
    })
  )
  .nullable()
  .describe(
    "The site's corners in order, NW corner first, proceeding clockwise. " +
      "Record every corner mentioned; the coordinates are converted in code."
  );

/**
 * Corners as the forms store them: both coordinates as numbers, or the row is
 * dropped. If no row survives, the whole answer becomes null and the question
 * is asked again — a corner read wrongly looks answered, is never revisited,
 * and draws the site somewhere it isn't.
 */
export function coerceCorners(value: unknown): unknown {
  if (!Array.isArray(value)) return null;
  const converted = value
    .map((row) => {
      const record = row as Record<string, unknown> | null;
      if (!record || typeof record !== "object") return null;
      const latitude = parseCoordinate(record.latitude, "latitude");
      const longitude = parseCoordinate(record.longitude, "longitude");
      if (latitude === null || longitude === null) return null;
      return { latitude, longitude };
    })
    .filter((row): row is { latitude: number; longitude: number } => row !== null);
  return converted.length > 0 ? converted : null;
}

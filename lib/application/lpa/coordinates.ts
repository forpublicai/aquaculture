/**
 * Reading a coordinate the way people actually give one.
 *
 * The form is explicit about what it wants: "Please enter your coordinates using
 * the following format: Decimal Degrees (43.123456 N, -69.123456 W)". So decimal
 * degrees is what gets stored, and the question asks for it.
 *
 * People do not have decimal degrees. A chartplotter, a handheld GPS and the
 * iPhone compass all show degrees, minutes and seconds, and that is what gets
 * typed: `43°39'02.2"N, 70°11'16.2"W`. Before this, that answer was simply lost.
 *
 * The conversion is done here, in arithmetic, rather than by asking the
 * extraction model to do it. Two reasons. A model doing sums silently is exactly
 * the thing this codebase keeps deciding not to trust, and it would sit awkwardly
 * against the instruction never to invent a value: converting a format is not
 * inventing, but a model reading "never invent" while looking at a number it
 * cannot use is as likely to return null as to convert. Better to take their
 * wording verbatim and do the arithmetic where it can be read and tested.
 *
 * What is accepted:
 *
 *   43.650611          decimal degrees
 *   -70.187833         decimal degrees, signed
 *   43.650611 N        decimal degrees with a hemisphere
 *   43°39'02.2"N       degrees, minutes, seconds
 *   43 39 02.2 N       the same, unpunctuated
 *   43° 39.037' N      degrees and decimal minutes
 *
 * West and south are negative, whether that arrives as a minus sign or as a
 * letter. A Maine longitude typed off a plotter carries a W and no sign, and
 * storing +70 would put the site in Mongolia.
 */

export type Axis = "latitude" | "longitude";

const LIMIT: Record<Axis, number> = { latitude: 90, longitude: 180 };
const NEGATIVE_HEMISPHERE: Record<Axis, string> = { latitude: "S", longitude: "W" };
const AXIS_LETTERS: Record<Axis, RegExp> = { latitude: /[NS]/i, longitude: /[EW]/i };

/**
 * The part of the text belonging to one axis.
 *
 * A model handed "43°39'02.2\"N, 70°11'16.2\"W" may pass the whole string to both
 * fields rather than splitting it, which is a reasonable thing for it to do with
 * an instruction to quote the applicant verbatim. Splitting on the hemisphere
 * letters is reliable when they are present; failing that, latitude is first and
 * longitude second, which is the order every format writes them in.
 */
function segmentFor(text: string, axis: Axis): string {
  const segments = text.split(/[,;]|\band\b/i).map((part) => part.trim()).filter(Boolean);
  if (segments.length < 2) return text;

  const matching = segments.filter((segment) => AXIS_LETTERS[axis].test(segment));
  if (matching.length === 1) return matching[0];

  // No letters to go on, so fall back to written order.
  const lettered = segments.filter((segment) => /[NSEW]/i.test(segment));
  if (lettered.length === 0) return segments[axis === "latitude" ? 0 : 1] ?? text;
  return text;
}

/**
 * A coordinate as decimal degrees, or null if it can't be read.
 *
 * Null rather than a best guess, deliberately. An unreadable coordinate gets
 * asked again, which costs a turn; a wrongly read one looks answered, is never
 * revisited, and goes out on the application pointing at open water.
 */
export function parseCoordinate(value: unknown, axis: Axis): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? inRange(value, axis) : null;
  if (typeof value !== "string") return null;

  const text = segmentFor(value.trim(), axis);
  if (text === "") return null;

  const parts = text.match(/\d+(?:\.\d+)?/g);
  if (!parts || parts.length === 0 || parts.length > 3) return null;

  const numbers = parts.map(Number);
  if (numbers.some((part) => !Number.isFinite(part))) return null;
  const [degrees] = numbers;
  const minutes = numbers[1] ?? 0;
  const seconds = numbers[2] ?? 0;
  // Guards the case where two coordinates arrive as one unsplittable string:
  // "43.65 70.18" would otherwise read as 43 degrees and 70 minutes.
  if (minutes >= 60 || seconds >= 60) return null;
  // Only the last component may carry a fraction. "43.65 39" is not a coordinate
  // in any format, it is two numbers that happened to end up together.
  if (parts.length > 1 && parts.slice(0, -1).some((part) => part.includes("."))) return null;

  const magnitude = degrees + minutes / 60 + seconds / 3600;
  const negative =
    /^\s*-/.test(text) || new RegExp(NEGATIVE_HEMISPHERE[axis], "i").test(text);

  return inRange(negative ? -magnitude : magnitude, axis);
}

function inRange(value: number, axis: Axis): number | null {
  return Math.abs(value) <= LIMIT[axis] ? value : null;
}

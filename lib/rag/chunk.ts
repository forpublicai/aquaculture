/**
 * Minimal recursive-style text splitter: tries paragraph, then line, then
 * sentence, then word boundaries, greedily packing content up to
 * `chunkSize` characters with `overlap` characters carried into the next
 * chunk so context isn't lost at a cut point.
 */
const SEPARATORS = ["\n\n", "\n", ". ", " "];

function splitOn(text: string, separators: string[]): string[] {
  if (separators.length === 0) return text.split("");
  const [sep, ...rest] = separators;
  const parts = text.split(sep);
  if (parts.length > 1) return parts.map((p, i) => (i < parts.length - 1 ? p + sep : p));
  return splitOn(text, rest);
}

export function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  const pieces = splitOn(text.trim(), SEPARATORS).filter((p) => p.length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (current.length + piece.length <= chunkSize) {
      current += piece;
      continue;
    }
    if (current) chunks.push(current);
    current = current.length > overlap ? current.slice(-overlap) + piece : piece;
    while (current.length > chunkSize) {
      chunks.push(current.slice(0, chunkSize));
      current = current.slice(chunkSize - overlap);
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

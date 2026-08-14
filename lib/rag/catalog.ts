/**
 * Maps knowledge-base filenames to a human title and the public URL the
 * document came from.
 *
 * This catalog is the single source of truth for what belongs in the knowledge
 * base: `scripts/fetch-knowledge-base.sh` reads it to decide what to download,
 * and the RAG layer reads it to turn a stored `source` (a filename, which is
 * what ingestion records) into something worth showing a user — "DMR Chapter 2
 * — Aquaculture Lease Regulations" rather than
 * "Chapter2_Aquaculture_Lease_Regulations.pdf".
 *
 * When you add a document, add it here and re-run the fetch script.
 */
import catalog from "@/data/knowledge-base-catalog.json";

export interface CatalogEntry {
  /** "pdf" is downloaded as-is; "page" is HTML converted to text on fetch. */
  kind: "pdf" | "page";
  /** Human-readable name, used in citations. */
  title: string;
  /** Public URL, so citations can link back to the real document. */
  url: string;
}

const CATALOG = catalog as Record<string, CatalogEntry>;

/**
 * Looks up a stored chunk's `source`. Falls back to the raw filename with no
 * link, so a document that was ingested but never catalogued still gets cited
 * rather than silently dropped.
 */
export function describeSource(source: string | undefined): { title: string; url: string } {
  if (!source) return { title: "unknown source", url: "" };
  const entry = CATALOG[source];
  return entry ? { title: entry.title, url: entry.url } : { title: source, url: "" };
}

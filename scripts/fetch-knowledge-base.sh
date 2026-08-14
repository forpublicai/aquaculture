#!/usr/bin/env bash
#
# Downloads every document listed in data/knowledge-base-catalog.json into
# data/knowledge_base/. After running this, run `npm run ingest` to chunk,
# embed, and index them into Supabase.
#
# The catalog is the single source of truth — it also gives the app the title
# and URL used in citations (see lib/rag/catalog.ts). To add a document, add it
# to the catalog and re-run this script; don't edit lists in here.
#
# Two kinds of entry:
#   "pdf"  — downloaded as-is.
#   "page" — an HTML page, converted to plain text with macOS's built-in
#            textutil. The PDFs are mostly blank application forms, which say
#            what to fill in but not what the license types are; these pages
#            carry the explanatory material.
#
# Usage:
#   bash scripts/fetch-knowledge-base.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/data/knowledge_base"
CATALOG="$REPO_ROOT/data/knowledge-base-catalog.json"
mkdir -p "$DEST"

if [ ! -f "$CATALOG" ]; then
  echo "Catalog not found: $CATALOG" >&2
  exit 1
fi

# Read "filename|url" lines out of the catalog for one kind of entry.
catalog_entries() {
  node -e '
    const catalog = require(process.argv[1]);
    const kind = process.argv[2];
    for (const [filename, entry] of Object.entries(catalog)) {
      if (entry.kind === kind) console.log(filename + "|" + entry.url);
    }
  ' "$CATALOG" "$1"
}

# bash 3.2 (the macOS default) has no `mapfile`, hence the read loop.
PDFS=()
while IFS= read -r line; do [ -n "$line" ] && PDFS+=("$line"); done < <(catalog_entries pdf)
PAGES=()
while IFS= read -r line; do [ -n "$line" ] && PAGES+=("$line"); done < <(catalog_entries page)

downloaded=0
failed=0

echo "Fetching ${#PDFS[@]} PDF(s) and ${#PAGES[@]} web page(s) into data/knowledge_base/"
echo

for entry in "${PDFS[@]}"; do
  name="${entry%%|*}"
  url="${entry#*|}"
  printf '  %-46s ' "$name"

  if ! curl -fsSL --retry 3 --retry-delay 2 --max-time 120 -o "$DEST/$name.part" "$url"; then
    printf 'FAILED — could not download\n'
    rm -f "$DEST/$name.part"
    failed=$((failed + 1))
    continue
  fi

  # A "not found" HTML page saved under a .pdf name would silently poison the
  # knowledge base, so confirm the PDF magic bytes before keeping it.
  if [ "$(head -c 4 "$DEST/$name.part")" != "%PDF" ]; then
    printf 'FAILED — not a PDF (URL has probably moved)\n'
    rm -f "$DEST/$name.part"
    failed=$((failed + 1))
    continue
  fi

  mv "$DEST/$name.part" "$DEST/$name"
  printf 'ok (%s KB)\n' "$(( $(wc -c < "$DEST/$name") / 1024 ))"
  downloaded=$((downloaded + 1))
done

if ! command -v textutil >/dev/null 2>&1; then
  echo
  echo "  NOTE: textutil not found (it ships with macOS) — skipping ${#PAGES[@]} web page(s)."
  echo "        The PDFs still work, but the assistant will struggle to explain"
  echo "        how the license types differ."
else
  echo
  for entry in "${PAGES[@]}"; do
    name="${entry%%|*}"
    url="${entry#*|}"
    printf '  %-46s ' "$name"

    if ! curl -fsSL --retry 3 --retry-delay 2 --max-time 120 -o "$DEST/$name.html" "$url"; then
      printf 'FAILED — could not download\n'
      rm -f "$DEST/$name.html"
      failed=$((failed + 1))
      continue
    fi

    textutil -format html -convert txt -encoding UTF-8 \
      -stdin -stdout < "$DEST/$name.html" > "$DEST/$name" 2>/dev/null || true
    rm -f "$DEST/$name.html"

    # Near-empty output means we got a redirect, a cookie wall, or a JS-only
    # shell rather than the real page.
    chars=$(wc -c < "$DEST/$name" 2>/dev/null | tr -d ' ')
    chars=${chars:-0}
    if [ "$chars" -lt 500 ]; then
      printf 'FAILED — only %s chars of text (not real content)\n' "$chars"
      rm -f "$DEST/$name"
      failed=$((failed + 1))
      continue
    fi

    printf 'ok (%s KB)\n' "$(( chars / 1024 ))"
    downloaded=$((downloaded + 1))
  done
fi

echo
echo "Downloaded $downloaded document(s)."

if [ "$failed" -gt 0 ]; then
  echo
  echo "$failed download(s) failed. DMR moves these files when they revise them."
  echo "Find the current version and update its url in:"
  echo "  data/knowledge-base-catalog.json"
  echo "Starting points:"
  echo "  https://www.maine.gov/dmr/aquaculture/applications-and-forms"
  echo "  https://www.maine.gov/dmr/aquaculture/laws-and-regulations"
  exit 1
fi

echo "Next step: npm run ingest"

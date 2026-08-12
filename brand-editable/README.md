# Editable logo source

`public-ai-logo-editable.pptx` — the logo mark and wordmark as native, editable PowerPoint shapes and live text, for building new lockups or extensions (e.g. a sub-brand or product wordmark) without vector-design software.

The shipped files in [`assets/`](../assets/) are outlined SVGs — the wordmark text has been converted to vector paths, which is correct for shipping but means it can no longer be retyped. This file rebuilds:

- **the mark** — red tile + white glyph — as two native shapes (a rectangle and a custom freeform), reconstructed to match `assets/public-ai-logo-mark.svg` exactly
- **the wordmark** — live text set in NB International Pro CG Bold, so it can be retyped

Opens in PowerPoint, Keynote, or Google Slides.

- **Slide 1** — instructions, including how to embed the brand font before sharing outside a machine that already has it installed
- **Slide 2** — logo lockups (from the shipped SVGs)
- **Slide 3** — type specimen: every font family, size, and role from the design system (`design.md` / `tokens/typography.css`)

Note: NB International Pro CG's files aren't included in this repo (see the root README's "Font licensing") — if you have your own licensed copy, install the **desktop** OTF/TTF locally first so the wordmark text renders correctly and can be embedded on save. Do **not** install the Neubau `*-webfont.ttf` files in Font Book; those are browser-only and macOS will reject them. The open fonts (Public Sans, Inter, Overpass, Overpass Mono, Roboto Flex) install from Google Fonts or your download zip as normal.

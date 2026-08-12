# Public AI Design System

The official brand and UI design system for **Public AI** — the movement for public AI, an open-source project building AI as public infrastructure. This repo is meant to be cloned or referenced directly: point a coding agent at it (or your own eyes) to build on-brand interfaces, marketing pages, or product UI for Public AI and its products (like the Inference Utility, chat.publicai.co).

## Using this with a coding agent

If you're working in [Claude Code](https://claude.com/claude-code), this repo doubles as a skill: drop it into your project (or reference it as a subtree) and invoke `/public-ai-design` — see [`SKILL.md`](SKILL.md). It'll read the guidelines below and build with the real tokens, components, and assets rather than guessing at the brand.

For any other agent or IDE assistant, just point it at [`design.md`](design.md) — that's the full, dense brand spec (voice, color, type, layout, iconography) an agent needs to design on-brand without reading every file.

## What's here

- [Figma: Public AI Design System](https://www.figma.com/design/Tr51dyCX0N8aeqZIUjJ0Ct/Public-AI-Design-System) — the bleeding edge of experiments and design tests. However, please treat this repo as the stable source of truth for the accepted Public AI Design System.
- [`design.md`](design.md) — the complete brand spec: content voice, color, type, layout, and iconography rules
- [`tokens/`](tokens/) + [`styles.css`](styles.css) — CSS custom properties for color, type, shape, and fonts
- [`components/`](components/) — React components (brand, buttons, arrows, navigation), each with a `.jsx`, a `.d.ts`, and a `.prompt.md` explaining how/when to use it
- [`guidelines/`](guidelines/) — standalone HTML specimen cards for color, type, and shape
- [`assets/`](assets/) — logo files (SVG/PNG), favicon, brand webfonts, hero/card imagery
- [`brand-editable/`](brand-editable/) — an editable PowerPoint version of the logo, for building new lockups or brand extensions without vector-design software
- [`ui_kits/inference-utility/`](ui_kits/inference-utility/) — a full page recreation (chat.publicai.co's landing page) showing the system assembled end to end

## Ground rules

- **Never redraw the logo.** Use the shipped SVGs in `assets/`, or extend from `brand-editable/` if you need a new lockup.
- **Brand red (`#EF3C24`) is loud and rare** — at most one accent element per view region. Everything else is near-monochrome black/white.
- **All text is black or a spot color** — never gray. Gray is for UI chrome (hover fills, surfaces), not readable copy.
- The full rationale for every rule above lives in [`design.md`](design.md) — read it before making judgment calls the tokens/components don't cover.

## Font licensing

**NB International Pro CG's font files are not included in this repo.** Public AI's license from Neubau is a domain-locked, self-hosted webfont license that explicitly prohibits redistributing the font files or making them available for download — publishing them here would violate that license. `tokens/fonts.css` still declares the `@font-face` rules and `--font-brand` falls back to Overpass Bold, so everything renders correctly without them; if you have your own licensed copy of the font, drop it into `assets/fonts/` locally (gitignored) to see brand text in the real typeface. Public Sans, Inter, Overpass, Overpass Mono, and Roboto Flex are open (Google Fonts) and load from there as normal.

**Webfonts ≠ desktop fonts.** Neubau's webfont kit (`*-webfont.ttf` / `.woff2`) is built for `@font-face` in a browser, not for installing in Font Book or PowerPoint. Those files ship with a stripped `name` table (empty family names, invalid PostScript names) — macOS will reject them with `'name' table usability` / `'name' table structure` errors. That's expected. For local desktop apps (PowerPoint, Keynote, Figma), use the **desktop OTF/TTF** from your Neubau license instead. The webfont files only need to live in `assets/fonts/` for CSS previews in a browser.

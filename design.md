# Public AI Design System

**Public AI** is the movement for public AI — an open-source project of many individuals and organizations building AI as public infrastructure ("What if AI were public infrastructure like highways, water, or electricity?"). Its flagship product is the **Inference Utility** (chat.publicai.co), which serves publicly-built open models like **Apertus** (Swiss AI). The design language is inspired by classic public-infrastructure brands: NB International Pro CG and Overpass fonts (highway-signage lineage), British Rail's "Flame Red" (#EF3C24), and a logo mark inspired by the old British Rail logo mark.

## Sources
- Figma: [Public AI Design System](https://www.figma.com/design/Tr51dyCX0N8aeqZIUjJ0Ct/Public-AI-Design-System) — components, styles, and the Inference Utility Home page at 3 breakpoints.
- Logo pack upload: official SVG/PNG lockups and favicon, processed into `assets/`; NB webfont files licensed separately and not redistributed here (see "Notes / caveats").
- GitHub: [forpublicai/publicai.co](https://github.com/forpublicai/publicai.co) and [forpublicai/publicai.network](https://github.com/forpublicai/publicai.network).

## CONTENT FUNDAMENTALS
- Voice: civic, plainspoken, collective. "We", "the people": "By the people, for the people", "We're looking for open source contributors to help build public AI".
- Rhetorical questions as headlines: "What if AI were public infrastructure like highways, water, or electricity?"
- Analogies to public infrastructure and consortium projects: "Airbus for AI", highways/water/electricity.
- Warm, human provenance notes: "With love, from Switzerland", "Imanol's team just launched Apertus…".
- Sentence case for headlines and body; ALL-CAPS reserved for buttons and footer nav links ("TRY IT", "LOG IN", "TERMS & CONDITIONS").
- Short CTAs, 1-3 words: "Try it", "Log in", "Contact us".
- No emoji. No hype-speak; superlatives only when factual ("the most powerful open-source language model ever released by a public institution").

## VISUAL FOUNDATIONS
- **Color**: near-monochrome black/white with one loud accent — brand red #EF3C24 — British Rail "Flame Red" (hover #FE6550). Hairlines and subtle surfaces are #F7F7F7. Max one red element per view region. A warm secondary set sits under the red, drawn from a vintage-library palette: **oak #a97954** for editorial accent text and rules, **leather #c29b87** sparingly for warm fills, **parchment #f6f2ea** as the paper-toned canvas behind specimens and long-form. These are supporting tones, never competitors to the red — oak and leather share the red's hue family, so keep them off surfaces directly adjacent to a red element, and label them with dark ink rather than white.
- **Accessibility**: all readable text is black (`--text-primary`) or a deliberate spot color (brand red, oak accent, white on dark fills). Never gray — gray is reserved for non-text UI (button hover fills, surfaces). Public infrastructure should be legible at every size.
- **Type**: Public Sans is the workhorse (Light 140px/60px display at line-height 0.9, tracking -5%/-3%; Regular 15px body; SemiBold 14 uppercase buttons). NB International Pro CG Bold 90px for brand statements/wordmarks. Overpass Bold 38px for mid headlines; Inter (Semi Bold 24 / Medium 18) for card/UI text; Overpass Mono 12 for spec labels and table items; Roboto Flex Medium 12 for tiny annotations.
- **Layout**: centered single column, max-width 1500, generous vertical padding (80-120px sections). Sections are framed by 0.5-1px #F7F7F7 hairline borders rather than background changes.
- **Corners**: pills (radius 1000) for buttons; 10px for square controls; 12-16px for cards/images; 20px bottom-only on the mobile nav sheet; 30px on the hero band.
- **Shadows**: nearly none — only `0 2px 4px rgba(0,0,0,0.05)` under the mobile nav sheet and a soft `0 -4px 20px rgba(0,0,0,0.1)` under the hero tablet.
- **Cards**: flat `rgba(0,0,0,0.05)` fills, radius 16, 32px padding, no border, image bleeding to the card edge.
- **Hover**: color swaps, no motion — red→#FE6550, black→#929292, gray control→red fill with off-white glyph.
- **Imagery**: real photography and product screenshots, warm and human (posters, people, landscapes); framed in 16px-radius rounds or inside device bezels. No illustration system, no gradients, no patterns/textures.
- **Animation**: none defined in the kit; keep to instant color transitions (~120ms) at most.

## ICONOGRAPHY
- Arrows are drawn glyphs: small chevrons in 40px squares, ↗ north-east arrow inside linkout buttons, hamburger = three 2px bars.
- No icon font, no emoji, no third-party icon set. Arrows and the hamburger are the only glyphs in the system, and they are drawn as components, not icons.
- Logos: always the shipped SVGs in `assets/` (mark = red tile + white "≥" glyph). Never redraw.

## Index
- `styles.css` → `tokens/` (fonts.css, colors.css, typography.css, shape.css)
- `assets/` — logos (public-ai-logo[-mark|network|inference-utility].svg/png), favicon, hero + card imagery (`assets/images/`); `assets/fonts/` is reserved for locally-licensed NB International Pro CG webfonts, gitignored and not part of this public repo
- `brand-editable/` — editable PowerPoint source for the logo mark + wordmark, for building new lockups/extensions without vector-design software
- `components/`
  - `brand/` — Logo, LogoMark
  - `buttons/` — Button, ButtonLinkout
  - `arrows/` — ArrowLeft, ArrowRight
  - `navigation/` — Navigation, NavigationMobile
- `ui_kits/inference-utility/` — Home page recreation (index.html)
- `guidelines/` — color/type/shape specimen cards
- `SKILL.md` — agent skill entry point

### Component inventory vs. Figma (complete)
Figma families → built: Arrow Left → ArrowLeft; Arrow right → ArrowRight; Button → Button; Button linkout → ButtonLinkout; Navigation → Navigation; Navigation mobile → NavigationMobile; Logo → Logo; logo_mark → LogoMark.

### Notes / caveats
- The Figma file defines no Figma Variables or shared text styles; tokens here are derived from the file's literal values.
- Fonts: NB International Pro CG's webfont files are **not included in this public repo** — Public AI's Neubau license is domain-locked and self-hosted-only, and prohibits redistribution (see README.md "Font licensing"). `tokens/fonts.css` declares the `@font-face` rules regardless; `--font-brand` falls back to Overpass Bold when the files aren't present locally. Public Sans, Inter, Overpass, Overpass Mono, Roboto Flex load from Google Fonts.
- The Home frame's chat box is a live code instance in Figma; the UI kit mocks it.

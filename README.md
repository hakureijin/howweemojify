# Emoji 进化志 · The Evolution of Emoji

A single-page bilingual (zh / en) scrollytelling web feature about emoji as a cultural artifact, anchored in publicly-sourced data and presented in a playful "Spotify Wrapped" register.

Published on port **7777**.

## Story

| § | Slug | 中文 | English | Accent |
|---|------|------|---------|--------|
| 01 | history | 进化之路 | The Evolution Path | `#ff7f6e` peach |
| 02 | criteria | 谁能成为 emoji | Who Gets In | `#6ed1b3` mint |

The page opens with an **interactive emoji-timeline wallpaper hero** — ~275 emojis ordered chronologically 1999→2026 on a flat cream background. Mouse-hover gently flicks nearby emojis aside via a GSAP magnetic field (`gsap.quickTo` + `elastic.out` spring-back); click any emoji to grow it 3× and push its neighbours, click again or hit Esc to collapse. Every emoji also drifts continuously in a per-glyph CSS keyframe loop (6–12 s, desynchronised by index) so the field is always alive. A central avoidance ellipse + radial vignette keep the title text legible.

§01 stacks three interactive charts. (1) An **interactive cumulative-growth chart**: each Unicode version is a focusable emoji medallion (the version's first highlight emoji on a circle); decade-anchor years (1999 / 2010 / 2015 / 2020 / 2024 / 2026) get larger medallions and a year label. Three range-zoom buttons — `全部 / 2015 → 至今 / 2020 → 至今` — narrow the x-domain so the dense 2015-onward markers spread out and become individually clickable. Tooltips reveal year + version + +new + cumulative total + **growth-percent vs. previous** + narrative + source on hover / Tab+Enter / tap; click pins them; Escape or outside-click dismiss. Two **version-diff dropdowns** beneath the chart let the reader pick any two contributing versions and see the added count + growth % + representative new emojis in a card. (2) An **interactive category treemap** plus a Unicode-version time slider show how the 9 Unicode CLDR emoji groups (Smileys & Emotion, People & Body, Animals & Nature, Food & Drink, Travel & Places, Activities, Objects, Symbols, Flags) take share of the cumulative catalogue from Unicode 6.0 (2010) through the latest release — drag the slider or hit play to watch the composition shift. Each tile shows a single hero emoji sized to fill the tile, with the group name and count in a slim bottom band. (3) An **interactive variant-complexity Sankey** decomposes the latest snapshot (Emoji 17.0, 3,944 entries) by the codepoint mechanism that produced each entry — base, skin-tone modifier, multi-skin-tone, ZWJ family, ZWJ role, hair-style, direction-flipped, and other ZWJ — and traces each mechanism into the same 9 CLDR groups. Default view is clean colored ribbons; **hover, focus, or pin a flow and emoji beads fade in along the curve** (count proportional to flow value, glyphs cycled from the flow's sample set), so the chart stays calm at rest and reveals what each flow is "made of" on demand.

§02 stacks a 5-step Unicode-proposal pipeline, a 6-card minimalist criteria grid (no decorative borders — tone conveyed by a small uppercase tag inside each card), 4 case cards (3 accepted including 🥟 dumpling / 🧕 headscarf / 🧉 mate, 1 rejected on policy grounds), and an **interactive pan/zoom cultural-origins world map** with **41 origin pins spanning 23 countries** from every populated continent — China (饺子 / 月饼 / 红包), Japan (寿司 / 便当 / ⛩️), India (sari / peacock / temple / rickshaw), Indonesia, Vietnam, Saudi Arabia, Lebanon, Türkiye, Ethiopia, Nigeria, Kenya, Egypt, Germany, France, Italy, Greece, Russia, Poland, Mexico (taco / tamale / piñata / avocado), Argentina, Peru, USA, Australia, New Zealand and more. Pins are anchored at **city-level coordinates** so multi-pin countries only resolve visually after zooming in. The map supports **mouse-wheel zoom toward cursor**, **drag-to-pan**, **two-finger pinch** on touch, and **keyboard navigation** (`+ / − / 0` and arrow keys when the SVG is focused), plus a floating `+ / − / ⟲` button group and a live zoom-level indicator. Each pin is a focusable button: hover / focus / click reveals a tooltip with the emoji + country code + year + city-level origin label, with the same pin-and-dismiss pattern as the §01 chart.

Every quantitative claim carries a public, citable source — every number, percentage, date, and ranking has a `source` field in the data JSON and surfaces in the footer bibliography.

## Tech stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 (CSS-variable token system)
- `next-intl` for locale-prefixed routing (`/zh`, `/en`)
- Framer Motion (chart animations, layout transitions, `<MotionConfig reducedMotion="user">` for global a11y)
- GSAP core + `@gsap/react` (hero emoji wallpaper hover + click only; no paid plugins)
- `d3-scale` / `d3-shape` / `d3-geo` / `d3-hierarchy` / `d3-sankey` + `world-atlas` topojson for custom SVG charts
- Vitest + React Testing Library + Playwright (for ad-hoc visual verification, not in CI)

## Run

```bash
# install
npm install

# dev (port 7777)
npm run dev

# production
npm run build && npm run start

# tests
npm test
```

Then open `http://localhost:7777/` — you'll be redirected to `/zh`. Use the language toggle in the top-right to flip between `/zh` and `/en`.

## Static control page & user-study logging

`/zh/static/` and `/en/static/` present the same information as the main page with no interaction and no motion — tooltips become labels and tables, the treemap slider becomes small multiples, the map's zoom becomes regional close-ups. The two versions do not link to each other. It is published on GitHub Pages alongside the main page.

For the user study, build and serve the experiment variant (language switch hidden, behaviour logging on):

```bash
npm run experiment            # build with NEXT_PUBLIC_EXPERIMENT=1, then serve on 0.0.0.0:7777
```

Give each participant one link:

- interactive: `http://<host>:7777/zh/?pid=P001`
- static:      `http://<host>:7777/zh/static/?pid=P001`

Events are appended to `logs/events-YYYY-MM-DD.jsonl` (UTC date, one JSON object per line, `logs/` is git-ignored): `session_start`, `scroll`, `section_dwell`, `visibility`, `heartbeat` (every 15 s), `link`, `session_end`, and — interactive page only — `interact` (`target`/`action`/`detail`). Every event carries `pid`, `sessionId`, `condition`, `locale`, `seq`, client time `t`, `serverTime` and `ip`; dedupe on `(sessionId, seq)`.

To run on a cloud VM, copy `out/` and `scripts/experiment-server.mjs` and run `node scripts/experiment-server.mjs` (env: `PORT`, `OUT_DIR`, `LOG_DIR`). Before a session, `python3 scripts/experiment_smoke.py` checks the whole pipeline.

Analysis notes:

- Dedupe on `(sessionId, seq)` — a batch can arrive twice (retry after a lost response, or a beacon at page hide).
- `maxDepthPct` is not comparable across conditions: the static page is longer, so the same reading covers a smaller share of it. Compare per-section dwell (`section_dwell`, and the `dwell` map on `heartbeat`/`session_end`) instead. A section counts as read while half of it, or half the viewport, is covered by it.
- `interact` pin semantics: `pin` opens a tooltip, `unpin` is a second click on the same item, `close` is any other dismissal of an open tooltip (Escape, click outside, the ✕ button, or a control change that resets the chart).
- A session restored from the browser's back/forward cache starts again with `session_start` carrying `resumed: true` (same `sessionId`, after the earlier `session_end`).
- The interactive page hides its hint lines below the `md` breakpoint, while the static page's legend notes are always visible.

Do not run `npm run build:experiment` while `npm run dev` is running — they share `.next/`.

## File layout

```
.
├── app/
│   ├── layout.tsx                # bare root (pass-through; locale layout owns <html>)
│   └── [locale]/
│       ├── layout.tsx            # locale layout + Providers (i18n + MotionConfig)
│       ├── page.tsx              # composes Hero + 4 chapters + Footer
│       └── globals.css           # Tailwind import + design tokens + reduced-motion CSS
├── components/
│   ├── Hero.tsx · TopNav.tsx · Footer.tsx · Providers.tsx
│   ├── hero/                     # EmojiField (interactive emoji wallpaper)
│   ├── ui/                       # Section wrapper · Citation
│   ├── chapter-01/               # CumulativeChart · CategoryTreemap · VariantSankey
│   └── chapter-02/               # WhoGetsIn · Pipeline · CriteriaCards · CaseCards · OriginMap
├── data/                         # chapter-01.json · chapter-01-categories.json · chapter-01-variants.json · chapter-02.json
├── messages/                     # zh.json · en.json — locale strings (parity-tested)
├── types/                        # Source · Chapter01–02 types
├── lib/                          # prefers-reduced-motion · countup · hero-emoji-timeline · hero-emoji-layout
├── i18n/                         # routing · request · navigation
├── public/world-atlas/           # countries-110m.json
├── scripts/                      # build-emoji-categories.mjs (fetches Unicode emoji-test.txt)
├── tests/                        # data contracts · logic · i18n parity
├── docs/superpowers/
│   ├── specs/                    # design specs
│   └── plans/                    # implementation plans
└── middleware.ts                 # next-intl locale routing
```

## Data and sourcing

Every chapter has a typed JSON data file under `/data` and a localized-string file under `/messages`. The two are intentionally decoupled so that adding/changing copy never requires touching code, and adding a new data row needs only:

1. Add the row to `data/chapter-XX.json` with its `source` block.
2. Add the `xxKey` translations to BOTH `messages/zh.json` and `messages/en.json`.
3. The i18n parity test (`tests/i18n/message-keys.test.ts`) fails fast if a key only exists in one locale.

Primary sources, by chapter:

- §01 timeline — `emojipedia.org/emoji-versions` (per-version pages from Emoji 6.0 through 18.0 draft) + `unicode.org/emoji/charts` (cumulative count cross-check) + `moma.org` (DoCoMo collection) + `apple.com/newsroom` (Genmoji) + `blog.emojipedia.org/whats-new-in-unicode-17-0` + `blog.emojipedia.org/draft-emoji-list-for-2026-2027` (Emoji 17.0 + 18.0 draft)
- §01 category treemap and variant Sankey — `unicode.org/Public/emoji/latest/emoji-test.txt` (Unicode CLDR — canonical group + version-added metadata for every fully-qualified emoji). The script at `scripts/build-emoji-categories.mjs` parses this file into both `data/chapter-01-categories.json` (per-version 9-group counts) and `data/chapter-01-variants.json` (latest-version variant-mechanism × group decomposition); re-run when a new Unicode version ships.
- §02 — `unicode.org/emoji/proposals.html` + individual L2 proposal PDFs at `unicode.org/L2/`

The Footer aggregates every cited `source` into a deduplicated bibliography grouped by chapter.

### Stand-in emoji glyphs

Two §01 versions ship with **stand-in emojis** on their medallion because their actual codepoints aren't yet supported by most system fonts:

- **Emoji 17.0** (Sept 2025, rolling out through 2026) — the canonical new chars are 🫪 Distorted Face, 🫯 Fight Cloud, 🫍 Orca, 🪊 Trombone, 🛘 Landslide, 🪎 Treasure Chest. The medallion shows 🫨 (Shaking Face) as a visual stand-in; the tooltip narrative names the actual characters.
- **Emoji 18.0** (draft, expected Sept 2026) — 19 provisional emojis (9 core + 10 skin-tone variants). Candidates include cracking face, pickle, lighthouse, meteor. Codepoints + glyphs are still subject to change, so the medallion uses approximate existing emojis (😬 🥒 🗼 ☄️) and is rendered with a dashed stroke + `DRAFT` badge.

Both narratives explicitly disclose the substitution.

## Accessibility

- **Reduced motion** — `<MotionConfig reducedMotion="user">` makes Framer Motion automatically substitute opacity-only or no-op animations when the OS preference is set. A global CSS `@media (prefers-reduced-motion: reduce)` rule catches anything outside Framer Motion (animation, transition, scroll-behavior). The hero emoji wallpaper specifically skips its GSAP magnetic-push hover, makes click-toggle scale changes instant, and disables the per-glyph CSS drift animation under this preference.
- **Keyboard** — All interactive elements (chapter chips, language toggle, range-zoom buttons, category chips, footer source links, cumulative-chart medallions, origin-map pins, origin-map zoom controls, every hero emoji button) carry `focus-visible:ring-2` styles in the appropriate accent color. Markers are reachable via Tab and activatable with Enter/Space; Escape dismisses any pinned tooltip and collapses any popped hero emojis. The origin-map SVG itself is focusable — `+ / −` zoom, `0` resets, and arrow keys pan when the map has focus.
- **Touch** — Every interactive chart marker carries a 44 × 44 px invisible hit area around its visible glyph to meet the WCAG / Apple-HIG touch-target minimum on mobile. Touch-only devices skip the hero's magnetic-push hover (`matchMedia('(hover: hover) and (pointer: fine)')`) but still get tap-to-enlarge.
- **Screen readers** — Chart medallions and map pins are `role="button"` with an `aria-label` describing what activating them will reveal. Pinned tooltips switch to `role="dialog"` with `aria-live="polite"`. Hero emoji buttons carry `aria-pressed` and a per-locale `aria-label` template (`hero.enlarge` / `hero.shrink`); the wrapping `EmojiField` div is `role="presentation"` so the ~275 buttons don't pollute the document outline.
- **Bilingual** — The `<html lang>` attribute is set per locale; the language toggle is labelled with `aria-label="Switch to <other locale>"`.

## Implementation history

This project was brainstormed, spec-written, plan-authored, reviewed, and executed across one Claude Code session using the Superpowers workflow:

1. `superpowers:brainstorming` — clarifying questions, design proposals, mockups
2. `superpowers:writing-plans` — 7-chunk / 42-task implementation plan
3. `superpowers:subagent-driven-development` — execution with implementer + reviewer subagents per task

Post-build refinements (designed against the `ui-ux-pro-max` and `frontend-design` skills):

- Interactive §01 cumulative-growth chart with emoji medallions, decade-milestone hierarchy, range-zoom for the dense 2015→ window, growth-percent in the tooltip, dynamic title, version-diff dropdowns, and x-axis compression that weights the pre-2010 stretch to 22% of the width so the 2014→ dense era can spread out (DRAFT badge on the Emoji 18.0 medallion sits on the left side of the medallion since the draft point lives at the chart's right edge)
- §01 emoji category treemap with a Unicode-version time slider + play/pause, animated rect transitions, and 9 CLDR group tiles driven by `data/chapter-01-categories.json` (built from `unicode.org/Public/emoji/latest/emoji-test.txt`); each tile is anchored by a single large emoji glyph sized to the tile, with a 3-tier label layout — wide tiles use a single-row label+count, narrower tiles stack label-on-top + count-below, and tiles too narrow for the label (e.g. "Smileys & Emotion" in 120 px at early Unicode versions) drop the label and keep just the count, so no text overflows its tile across any of the 17 slider frames
- §01 variant-complexity Sankey: 8 variant mechanisms (base, skin-tone, multi-skin-tone, ZWJ family / role / other, hair-style, direction-flipped) flowing into the same 9 CLDR groups, driven by `data/chapter-01-variants.json` (also built from `emoji-test.txt`, classifier exported as `classifyEmojiVariant` for unit testing); hover / focus / pin a flow to reveal emoji beads along its Bézier curve (count scales with `log2(flow.value)`, ~9 beads for the biggest flows, ~1 for the smallest)
- Emoji 17.0 (Sept 2025, 163 new) + Emoji 18.0 (draft, 2026) data, with stand-in glyphs and a draft badge
- §02 minimalist criteria cards (left-edge stripe removed) and §02 interactive pan/zoom origin-map — expanded from 8 to 41 culturally-iconic pins across 23 countries with city-level coordinates, wheel/drag/pinch/keyboard navigation, counter-scaled pins, and the same pin/dismiss interaction pattern
- Hero replaced with `<EmojiField>` — ~275 chronologically-ordered emojis on a flat cream background with GSAP magnetic-push hover, click-to-enlarge toggle, and always-on per-glyph CSS-keyframe drift; central avoidance ellipse + cream vignette keep the title legible (`docs/superpowers/specs/2026-05-26-emoji-hero-design.md` and `…/plans/2026-05-26-emoji-hero.md`)
- §01 simplified — chapter eyebrow / title / intro block and the horizontal pin-and-translate emoji-version timeline strip both removed; the section now contains only the three interactive charts above
- Global a11y pass: MotionConfig + reduced-motion CSS + focus-visible rings throughout

Spec history under `docs/superpowers/specs/` and plan history under `docs/superpowers/plans/`.

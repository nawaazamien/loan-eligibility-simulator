# Design handoff — what was imported and what it specifies

This summarises the approved design as inspected on 2026-10-19. The verbatim source files are in [`design/reference/`](../design/reference/). Where this summary and the reference disagree, the reference wins, unless [DECISIONS.md](DECISIONS.md) records a deliberate change.

## 1. Import record

| Item                | Value                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source              | Claude Design project `8202c9a6-86b8-47d8-a621-0fc66e15abca` (claude.ai/design), read through the Claude Design MCP                                                                                                                        |
| Selected file       | `Loan Simulator Board.dc.html`                                                                                                                                                                                                             |
| Project file list   | `HANDOFF.md`, `Loan Simulator Board.dc.html`, `LoanSimulator.dc.html`, `support.js`, `.thumbnail`, `_ds/industry-2fec05b7-7c26-49fc-ad42-36347baa1980/{_ds_bundle.js, styles.css, readme.md, _ds_manifest.json, _adherence.oxlintrc.json}` |
| Files read in full  | All of the above except `.thumbnail` (a binary cover image, not needed)                                                                                                                                                                    |
| Stored locally      | `Loan Simulator Board.dc.html`, `LoanSimulator.dc.html`, `HANDOFF.md`, `_ds/…/styles.css`, `_ds/…/_ds_bundle.js`, `_ds/…/readme.md` (committed); `support.js` (local only, git-ignored)                                                    |
| Not stored          | `_ds_manifest.json` and `_adherence.oxlintrc.json`: generated metadata whose content (token list, "no raw hex/px, Barlow only" lint hints) is captured below                                                                               |
| Rendered inspection | `LoanSimulator.dc.html` rendered locally in headless Chromium at 1280 px and 360 px through its own runtime and compared with the Phase 0 shell                                                                                            |

## 2. What the selected file is

`Loan Simulator Board.dc.html` is a **presentation board**, not the application. It contains:

- a design-notes panel (structure, behaviour and fictional-model notes);
- nine desktop artboards at 1280 px (states 1a–1i) and four mobile artboards at 360 px (1j–1m);
- a "Try next" prompt line for the design tool.

Every artboard is a `<dc-import name="LoanSimulator" preset="…" layout="…">` of the one real screen, **`LoanSimulator.dc.html`**. That file is the live reference component: all copy, states and logic, rendered by the preview runtime.

Not to be shipped: the board chrome (`dv-*` classes, artboard labels, notes, "Try next"), the `preset`, `layout` and `demoFocus` preview props, the forced focus outlines used to illustrate focus states, and `support.js`.

### Role of the referenced scripts

- **`support.js`** (about 69 KB, generated from `dc-runtime/src/*.ts`): the Claude Design preview runtime. It loads React 18.3.1, ReactDOM and Babel Standalone from unpkg, parses the `<x-dc>` template, compiles `{{ }}` bindings, `<sc-if>` and `<sc-for>`, evaluates the component's logic class with `new Function`, and resolves `<dc-import>`. It is tooling for the design canvas. It is **not** used in production, and its eval-based approach would conflict with a strict CSP anyway.
- **`_ds_bundle.js`**: an empty namespace stub (`window.Industry_indust`) with no components.
- **`styles.css`**: the Industry design-system tokens and component classes. This is the token source.

## 3. Product identity

- Product name **Tally**, fictional and neutral, always shown with a **Demo** tag. No bank branding, logo or imagery; the wordmark is text.
- Positioning copy: header tagline "Fictional estimates · Not a credit check" (≥ 760 px only), and an intro and footer that both disclaim credit checks, approvals and offers.

## 4. Layout

Single page: header → main (H1 + intro, then a two-panel grid) → footer.

| Property                       | < 760 px         | ≥ 760 px                                                   |
| ------------------------------ | ---------------- | ---------------------------------------------------------- |
| Content max-width              | 1160 px          | 1160 px                                                    |
| Page side padding              | 16 px            | 32 px                                                      |
| Main padding                   | 24 16 32         | 40 32 48                                                   |
| Grid                           | 1 column, gap 28 | `minmax(0,7fr) minmax(0,5fr)`, gap 32, `align-items:start` |
| Panel padding                  | 20 18            | 28 30                                                      |
| H1                             | 34 px            | 46 px                                                      |
| Repayment figure               | 48 px            | 60 px                                                      |
| Input / term control max width | 100%             | 420 px                                                     |
| Calculate button               | grows            | intrinsic                                                  |
| Results panel                  | static           | sticky, top 16 px                                          |
| Assumptions list               | stacked          | 130 px term column + value                                 |

There is one breakpoint, 760 px. The design requires reflow without horizontal scroll at 320 px and at 200%/400% zoom.

Rendered observation: the reference rendered through its own runtime at a 360 px viewport produced a 366 px wide page. That is about 6 px of overflow, from the preview runtime's container-width sizing. The implementation must not repeat it, and the Phase 0 e2e suite checks 320 px and 360 px for zero overflow.

## 5. Typography

- Headings: **Barlow Condensed 600**. Body: **Barlow 400/500/600**. Both are SIL OFL 1.1.
- The design's `styles.css` loads them from Google Fonts (Barlow 400/500/700, Condensed 400/600). The handoff recommends self-hosting via `@fontsource`. **Implemented:** `@fontsource/barlow` and `@fontsource/barlow-condensed` 5.3.0, Latin subset only, weights 400/500/600 and 600. The component uses 600, not 700, for emphasis.
- Body 15/1.55. Labels 15/500. Helper text 13.5/1.45 in neutral-700. Error text 14/500 critical. Section legends 12 px, uppercase, 0.1em tracking, 500, accent-700. H2 25, H3 18–20. Inputs 16 px (avoids iOS zoom). Numbers use `tabular-nums`.

## 6. Colour and semantic tokens

From `styles.css` (Industry system) plus product additions from `HANDOFF.md` §4:

| Token                                              | Value                                                       | Use                                                           |
| -------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| `--color-bg`                                       | `#f2f2f3`                                                   | page ground                                                   |
| `--color-surface`                                  | `#e9e9ea`                                                   | input fill                                                    |
| `--color-text`                                     | `#1d1f20`                                                   | body text                                                     |
| `--color-divider`                                  | `color-mix(#1d1f20 16%, transparent)`                       | hairlines, frames                                             |
| `--color-accent`                                   | `#5980a6`                                                   | fills, large text, UI only (≥ 3:1)                            |
| `--color-accent-100 / 400 / 600 / 700 / 800 / 900` | `#eef6ff / #94bce3 / #597ea3 / #416180 / #2c455d / #1d2d3d` | tints, hover, pressed, accent text (700), Demo tag text (800) |
| `--color-neutral-100 / 400 / 700 / 800`            | `#f5f5f8 / #b7b7ba / #5d5d60 / #424244`                     | stale banner bg, bar segments, helper text, secondary text    |
| `--color-critical` (+ bg, border)                  | `#a3392b` (`#fbefec`, `#e0a397`)                            | errors, "no room" outcome (functional only)                   |
| `--color-caution` (+ bg, border)                   | `#8a5a00` (`#fbf4e6`, `#d9b26a`)                            | "above limit" outcome (functional only)                       |

The design defines a light theme only. A dark theme is out of scope.

## 7. Spacing, borders, radii, shadows

- Everything is square (radius 0) with no shadows. The Industry system has radius and shadow tokens, but this design overrides them.
- **Blueprint frame**: the form panel, results panel and primary button get a 1 px divider border plus four 11×11 px "+" registration marks offset −6 px outside each corner, in text colour at 55%. Panels have no fill. Implemented as the `Frame` component.
- Spacing in px: 2, 4, 6, 10, 12, 14, 16, 18, 22, 28, 32, 40. Field internal gap 6, between fields 22, form sections 28, results stack 22.

## 8. Components and icons

Planned hierarchy, from `HANDOFF.md` §3: SiteHeader, PageIntro, the simulator grid, and LoanForm (form header with "Use example values", ErrorSummary, two fieldsets, CurrencyField ×4, LoanSlider, TermSelector, FormActions with FormStatus). Then ResultsPanel (EmptyState, StaleBanner, OutcomeStatus, RepaymentFigure, Explanation, ResultSummary `dl`, IncomeBreakdown bar and legend, NextSteps, AssumptionsDisclosure), a LiveAnnouncer, and SiteFooter.

Icons: Lucide at stroke 1.5, decorative (`aria-hidden`). CircleCheck (within), TriangleAlert (above), CircleMinus (none), CircleAlert (errors), RefreshCw (stale), Info (form status), Calculator (empty state, 32 px accent), ChevronDown (disclosure, rotates 180°). The reference inlines the SVG paths. The handoff recommends `lucide-react` (ISC licence), to be added in Phase 1.

## 9. Form controls and visible states

- Currency inputs: `type="text" inputMode="decimal" autoComplete="off"`, a visible decorative "R" prefix, min-height 46, surface fill, divider border, darker border on hover. Error state adds a critical border and a 1 px ring.
- Loan slider: native range from 1 000 to 250 000, step 1 000, `accent-color`, synced with the text field. The text field is the source of truth.
- Term: native radios inside `fieldset`/`legend`, styled as a 5-cell segmented control (52 px cells, number over "months"). Checked cells are accent-filled, with an inset focus ring.
- Buttons: primary (accent fill, framed, Barlow Condensed 18), secondary (outlined), ghost (accent-700 text). Minimum height 48 (44 for the ghost button).
- Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px` on every control. It is never removed.
- Board states: 1a initial · 1b within · 1c above with next steps · 1d none · 1e empty fields · 1f invalid values (entries preserved) · 1g stale · 1h after reset · 1i focus on the expanded assumptions disclosure · 1j–1m mobile variants.

## 10. Intended interactions

- Nothing calculates while typing. Validation runs on submit, then per field on blur. Valid values are reformatted on blur (`28500` → `28 500`).
- A failed submit shows an error summary (`role="alert"`, focused) with links that focus each field. Values are never cleared.
- A successful calculation updates a polite live region, moves focus to the "Your estimate" heading and, below 760 px, scrolls to it (smoothly unless reduced motion is set).
- Editing after a result marks it out of date (banner, neutral outcome block, bar dimmed to 45%, and an extra note under the button on mobile). The old result stays visible until recalculation.
- "Use example values" fills 28 500 / 14 200 / 3 150 / 60 000 / 48 months and does not calculate. "Reset" restores the defaults, announces the reset and focuses the income field.
- The "How this estimate is calculated" disclosure is a button with `aria-expanded`/`aria-controls` and a `hidden` region.

## 11. Exact copy

The full product copy, including field labels, helper text, every validation message, outcome titles, explanation templates, next steps, assumptions and the footer, is preserved verbatim in [`design/reference/HANDOFF.md` §5–6](../design/reference/HANDOFF.md) and in the logic block of [`LoanSimulator.dc.html`](../design/reference/LoanSimulator.dc.html). Phases 1–2 must use those strings exactly. Phase 0 uses these verbatim strings:

- Header: "Tally" · "Demo" · "Fictional estimates · Not a credit check"
- H1: "Loan eligibility simulator"
- Intro: "See an illustrative estimate of what a personal loan could cost each month, and whether it fits a simple demo affordability rule. This isn't a credit check, an approval or an offer."
- Panel headings: "Your details" · "Your estimate" · "Illustrative only"
- Footer: "Tally is a demonstration project built for a front-end engineering assessment. It isn't affiliated with any bank or lender, doesn't store your information and doesn't perform credit checks."
- Page title: "Loan eligibility simulator · Tally (demo)", with `lang="en-ZA"`.

Wording review: the design consistently uses estimate language ("estimate", "illustrative", "demo affordability limit", "not a credit decision"). It contains no approval or offer language, so **no copy changes are needed**. The word "eligibility" appears only in the product title, which comes from the assignment.

## 12. Assets and provenance

| Asset                                    | Provenance / licence                                                       | Use                                            |
| ---------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Design files (`*.dc.html`, `HANDOFF.md`) | Owner's Claude Design project                                              | reference only (`design/reference/`)           |
| Industry `styles.css`, `readme.md`       | Claude Design–generated design system in the owner's project               | token source, reference only                   |
| Barlow, Barlow Condensed                 | SIL OFL 1.1 (The Barlow Project Authors) via `@fontsource`                 | self-hosted in the bundle                      |
| Lucide icons                             | ISC licence                                                                | planned for Phase 1 via `lucide-react`         |
| Favicon                                  | Made for this project: a "T" on the accent colour, as the handoff suggests | `public/favicon.svg`                           |
| `support.js`                             | Generated Claude Design runtime; no licence stated                         | inspected only; git-ignored, not redistributed |

There are no images, illustrations or third-party logos.

## 13. Gaps and conflicts with the assignment

| Topic                      | Observation                                                                                                                | Resolution                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Inputs                     | The assignment asks for income, expenses and loan amount. The design adds existing debt and term.                          | Follow the design (superset). See D-002.                                                          |
| Stack                      | The handoff names React 18. React 19 is the current stable release.                                                        | React 19. See D-003.                                                                              |
| Rounding                   | The handoff says "round only for display". The engineering brief requires no accidental floating-point boundary decisions. | Integer cents and a rounded instalment. See D-008 and [SIMULATION_MODEL.md](SIMULATION_MODEL.md). |
| Container port             | The handoff example uses `-p 8080:80`.                                                                                     | Non-root nginx listens on 8080. See D-006.                                                        |
| Code layout                | The handoff suggests `src/lib` and `src/state`.                                                                            | `src/features/loan-simulator/…`. See D-004.                                                       |
| Reference example figure   | The handoff's formatting sample "R1 878.96" does not match the computed example (R1 878.88).                               | Use computed values. See SIMULATION_MODEL §6.                                                     |
| Open: total repayable fees | The handoff leaves open whether fees are included.                                                                         | Included. See D-009.                                                                              |
| Open: sessionStorage       | The handoff recommends no persistence.                                                                                     | No persistence. See D-010.                                                                        |
| Responsive mechanism       | The reference switches layout on container width (ResizeObserver).                                                         | CSS media query at 760 px. See D-005.                                                             |
| Not designed               | Dark theme, 404 page, loading states                                                                                       | Out of scope. Unknown paths return nginx 404.                                                     |

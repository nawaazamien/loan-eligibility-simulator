# Phase 3 accessibility and quality review

**Scope:** the whole customer-facing page in every state a customer can reach: initial, within, above, no room, invalid submission, out of date, assumptions expanded, after reset.
**Target:** WCAG 2.2 AA. This review found and fixed defects and records what was verified and how. It is **not** a conformance certification: automated checks passed for the tested states, and the manual checks listed under [Gaps](#9-remaining-verification-gaps) still need a person.

## 1. What was tested

| Item                         | Value                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Code                         | the Phase 3 commit (parent `f77d372`); CI results for the pushed commit are in [PROJECT_PLAN.md](../../PROJECT_PLAN.md)         |
| Machine                      | Windows 11 Pro, Node 24.18.0, npm 11.16.0                                                                                       |
| Browsers (Playwright 1.64.1) | Chromium (Chrome for Testing 156.0.8078.4), Firefox 157.0, WebKit 27.2. All headless unless stated                              |
| Automated rules              | axe-core 4.13.0 via `@axe-core/playwright` 4.13.0, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice` |
| Build                        | the production bundle (`vite build` then `vite preview`); CI also runs every browser suite against the Docker container         |

## 2. Automated checks (axe)

`e2e/a11y.spec.ts` scans the **whole page**, with no excluded regions or disabled rules, after each state has settled, at 1280, 360 and 320 px (Chromium).

| Run                | Result                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First run          | **24 failed**: one rule, `color-contrast` (serious), on two elements. Light text on the accent fill: the selected term cell (`#f2f2f3` on `#5980a6`, 3.71:1) and **Calculate estimate** (3.80:1 in its hover colour). Both need 4.5:1: 18–19 px at weight 600 is not "large text" |
| After the fix (§6) | **24 passed**: 8 states × 3 viewports, no violations                                                                                                                                                                                                                              |

Passing axe means these rules found nothing in these states. axe cannot judge, for example, whether a field's border is visible enough, whether an announcement is sensible, or whether focus order matches the visual order. Those were checked separately below.

## 3. Keyboard and focus

**Method:** real key presses (Playwright `keyboard.press`) in real browser engines. From the top of the page, Tab and then Shift+Tab were pressed through every stop. At each stop the probe recorded the focused element, whether its focus outline is drawn, whether it is fully inside the viewport, and whether anything else covers its centre (`elementFromPoint`). This ran in 4 states (initial, invalid, above with assumptions open, out of date) × 7 configurations: 1280×900, a short 1280×600 desktop (sticky estimate panel), emulated 200% and 400% zoom, phone landscape 740×360, phone 360×800, and Firefox at emulated 200%.

| Check               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order               | Use example values → (error-summary links, when shown) → income → expenses → debt → loan amount → loan slider → term group (one stop) → Calculate → Reset → (Recalculate, when out of date) → assumptions toggle. Matches the visual order in every layout                                                                                                                                                                                                                            |
| Shift+Tab           | The exact reverse in every configuration. Firefox, started from its toolbar, needed a reverse walk started from the last control; its order was then identical                                                                                                                                                                                                                                                                                                                        |
| Traps               | None. After the last control focus leaves the page (Chromium: to `body`; Firefox: to its own toolbar)                                                                                                                                                                                                                                                                                                                                                                                 |
| Focus visible       | A 2px outline on every stop in every configuration; on the selected term an inset ring in the page colour (5.78:1 against its fill)                                                                                                                                                                                                                                                                                                                                                   |
| Focus obscured      | Nothing covered any focused control, including with the sticky estimate panel at 1280×600                                                                                                                                                                                                                                                                                                                                                                                             |
| Focus in view       | **Defect (Firefox), fixed**: when Tab landed on a control already partly on screen, Firefox did not scroll. At emulated 200% zoom (640×450), Calculate and Reset stayed at 429–477 px in a 450 px viewport (only 42% visible). Not a 2.4.11 failure (that criterion covers author content hiding focus, not the viewport edge), but worse than it needs to be. Fixed with `html { scroll-padding-block: 24px }` (D-036); afterwards every stop was fully in view in all three engines |
| Radios              | Arrow keys move and select within the term group (Chromium, Firefox, WebKit)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Slider              | Arrow Right moves it by one R1 000 step and writes "51 000" into the loan field (all three engines)                                                                                                                                                                                                                                                                                                                                                                                   |
| Enter               | Submits from any field (all three engines)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Error summary       | Focused after an invalid submit; each link moves focus to its field                                                                                                                                                                                                                                                                                                                                                                                                                   |
| After a calculation | Focus moves to "Your estimate" (with a visible ring); on phones it is scrolled into view                                                                                                                                                                                                                                                                                                                                                                                              |
| Reset               | Focus moves to the income field                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| While editing       | Focus never moves on its own: no change, blur or out-of-date state moves it                                                                                                                                                                                                                                                                                                                                                                                                           |

## 4. Screen readers

**No screen-reader testing was performed.** NVDA is not installed on this machine. Narrator is present, but this session cannot hear or log its speech output, so nothing it would announce could be verified. The following are **not** screen-reader testing, and are recorded only as supporting evidence:

- **Accessibility-tree inspection** (Chromium `ariaSnapshot`): banner, main and contentinfo landmarks; one H1, then H2 "Your details" and H2 "Your estimate"; the form and estimate region are named by their headings; the field names include the unit ("Monthly take-home income in rand"); helper text is the description; the term choices are a named group of radios ("36 months", checked); the slider is "Loan amount slider" with value text "R50 000"; the error summary is an `alert` named "Check 3 fields before calculating".
- **Live-region content** (unit and browser tests): one polite region holds one sentence per successful calculation ("Estimate updated. Within the demo affordability limit. Estimated monthly repayment R1 878.88."). An identical recalculation replaces it with a new element, and a failed resubmission leaves it untouched. The out-of-date banner is in a `role="status"` region that already exists, and the phone-only note under the form is not live.

### Manual checklist for Nawaaz (NVDA + Firefox or Chrome, or Narrator + Edge)

1. Press H and D (NVDA) or use the landmarks/headings lists: you should hear one H1, two H2s, and banner, main, form and region landmarks.
2. Tab into the income field: you should hear "Monthly take-home income in rand, edit", then the helper text.
3. Tab to the slider: you should hear its name and "R50 000"; Arrow Right should say "R51 000".
4. Tab to the term group: you should hear "Repayment term, grouping", the hint, and "36 months, radio button, checked, 3 of 5". Arrow keys should announce each choice.
5. Select **Calculate estimate** with every field empty. Focus should land on the error summary, and the alert should be read once. Follow a link: focus should move to that field, which should be read as invalid with its error before its hint.
6. Select **Use example values**, then **Calculate estimate**. You should hear "Estimate updated. Within the demo affordability limit. Estimated monthly repayment R1 878.88." **once**, then focus on "Your estimate, heading level 2".
7. Calculate again without changes: the sentence should be read once more, not twice.
8. Change the income: the out-of-date message should be read once, not on every key press.
9. Select **Reset**: you should hear the reset message, and focus should be in the income field.
10. Open and close "How this estimate is calculated": you should hear "expanded" and "collapsed".

## 5. Zoom, reflow, text spacing and text size

| Check                      | Method                                                                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 200% zoom                  | **Emulated**: a 1280×900 window at 200% is a 640×450 CSS-pixel viewport at device scale 2 (Chromium and Firefox)                                                                  | No overflow, clipping or lost content; keyboard pass as in §3                                                                                                                                                                                                                                                                                                                                                      |
| 400% zoom                  | **Emulated**: 320×225 CSS px at device scale 4 (Chromium)                                                                                                                         | No horizontal scrolling, clipping or lost content in any state; focus stays visible and in view                                                                                                                                                                                                                                                                                                                    |
| Real browser zoom (Ctrl +) | Attempted: Playwright's key presses go to the page, not the browser UI. Ctrl+= ×3 left `innerWidth` and `devicePixelRatio` unchanged in Chromium and Firefox, headless and headed | **Not verified**; manual check below                                                                                                                                                                                                                                                                                                                                                                               |
| Narrow phones              | 320×640, 360×800 (Chromium); WebKit 390×844                                                                                                                                       | No overflow; long values (R1 000 000 income, R23 167.84 repayment, −R1 482 a month) wrap inside their cells                                                                                                                                                                                                                                                                                                        |
| Short landscape            | 740×360 (phone layout) and 1280×600 (desktop with sticky panel)                                                                                                                   | No overflow; nothing covers focus                                                                                                                                                                                                                                                                                                                                                                                  |
| Text spacing (WCAG 1.4.12) | Injected: line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em; then checked for page overflow, clipped boxes and text past the edge                | No problems in any state or configuration. A positive control (forcing 420px content into 320px) was reported correctly, so the check does detect problems                                                                                                                                                                                                                                                         |
| Browser text size          | Firefox with default font size 16 → 32px (`font.size.variable.x-western`)                                                                                                         | **Defect, fixed** (D-035): every font size was in `px`, so text ignored the setting (body stayed 15px at a 32px default). Converted to `rem`, identical at 16px. Two follow-on layout defects at 32px were also fixed: the "R" prefix overlapped the value (the padding now scales), and the term group was clipped at 360px (cells now wrap). Now body text is 30px and the H1 92px, with no overflow or clipping |

Remaining cosmetic issue at very large text: the repayment figure (48px on phones, 96px at a 32px default) breaks inside the number on a 360px screen ("R1 878." / "88"). It stays complete and readable.

## 6. Contrast

Ratios are WCAG 2.x relative luminance, computed from the token values (`src/styles/tokens.css`), with translucent dividers composited onto their background.

| Pair (foreground on background)                                                | Ratio               | Needs |          |
| ------------------------------------------------------------------------------ | ------------------- | ----- | -------- |
| Body text `#1d1f20` on page `#f2f2f3`                                          | 14.79               | 4.5   | pass     |
| Input text on input fill `#e9e9ea`                                             | 13.64               | 4.5   | pass     |
| Helper, kicker, footer `#5d5d60` on page                                       | 5.87                | 4.5   | pass     |
| "R" prefix `#5d5d60` on input fill                                             | 5.41                | 4.5   | pass     |
| Secondary text `#424244` on page                                               | 8.96                | 4.5   | pass     |
| Legends, ghost button, tip numbers `#416180` on page                           | 5.78                | 4.5   | pass     |
| Demo tag `#2c455d` on `#eef6ff`                                                | 9.10                | 4.5   | pass     |
| Error text and links `#a3392b` on page                                         | 5.91                | 4.5   | pass     |
| Shortfall note `#8a5a00` on page                                               | 5.30                | 4.5   | pass     |
| Outcome titles: within / above / no room on their tints                        | 5.93 / 5.41 / 5.87  | 4.5   | pass     |
| Outcome notes `#424244` on each tint                                           | 8.91–9.20           | 4.5   | pass     |
| Out-of-date banner text on `#f5f5f8`                                           | 15.21               | 4.5   | pass     |
| **Before:** button / selected-term text on accent `#5980a6`                    | **3.71**            | 4.5   | **fail** |
| **Before:** button text on hover `#597ea3`                                     | **3.80**            | 4.5   | **fail** |
| **After:** on `--color-action` `#416180` / hover `#2c455d` / pressed `#1d2d3d` | 5.78 / 8.87 / 12.56 | 4.5   | pass     |
| Focus ring `#5980a6` on page                                                   | 3.71                | 3     | pass     |
| Selected-term focus ring: page colour on `#416180`                             | 5.78                | 3     | pass     |
| Selected term fill `#416180` vs page (state indicator)                         | 5.78                | 3     | pass     |
| Slider thumb and filled track `#5980a6` vs page                                | 3.71                | 3     | pass     |
| **Before:** text-field border (divider) vs page / vs fill                      | **1.38 / 1.37**     | 3     | **fail** |
| **After:** text-field border `#7a7a7d` vs page / vs fill                       | 3.82 / 3.53         | 3     | pass     |
| Invalid field border and error-summary border `#a3392b` vs page                | 5.91                | 3     | pass     |

Judgements recorded rather than changed:

- **Term-group lines and the Reset button outline (1.38:1).** These controls are identified by their visible text ("12 months", "Reset"), and the selected term by a 5.78:1 fill. WCAG 1.4.11 does not require a boundary for controls identified by text, so the design's hairlines are kept.
- **The slider's unfilled track** is drawn by the browser (`accent-color`). The thumb and the filled part carry the value at 3.71:1, and the text field beside it is the precise control.
- **Outcome-block borders** are decorative: each outcome also has an icon and a written title.
- There are **no disabled controls** in the shipped interface.

## 7. Other checks

| Check                                  | Method                                                                | Result                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forced colours (Windows high contrast) | Chromium `emulateMedia({ forcedColors: 'active' })`                   | **Defect, fixed** (D-034): the selected term looked identical to the others, because forced colours remove author backgrounds and the radio dot is hidden. Now it uses the system `Highlight`/`HighlightText` colours. The breakdown bar and key gained outlines (they are decorative; the legend text carries the values). See `forced-colours-term-before.png` / `-after.png` |
| Reduced motion                         | Chromium at 360px with `reducedMotion: 'reduce'` vs `'no-preference'` | With reduce, the page jumps straight to the estimate (scroll position 1333 immediately and after 1s); without it, it animates (795 → 1333)                                                                                                                                                                                                                                      |
| Target size (2.5.8)                    | Bounding boxes of every control at 360px                              | All at least 24×24 CSS px: buttons 44–48px tall, fields 46, slider 32, term cells 58×52. Error-summary links were about 22px tall on one line (they passed through the spacing exception); 2px padding makes them about 26px (D-039)                                                                                                                                            |
| Autocomplete                           | —                                                                     | Amount fields use `autocomplete="off"`; there are no personal-data fields, so 1.3.5 does not apply                                                                                                                                                                                                                                                                              |

## 8. Browser coverage

| Engine   | Where        | What                                                                                                                                                          |
| -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium | local and CI | Full suite at 1280, 360 and 320 px: layout, interactions, results, axe and regression checks                                                                  |
| Firefox  | local and CI | Core-flow smoke (render, valid and invalid submit, out of date and recalculate, reset, keyboard), the focus-into-view regression, and a 32px-default-font run |
| WebKit   | local and CI | Core-flow smoke at 390×844 with touch. This is Playwright's WebKit build on Windows and Linux, **not** Safari on a real iPhone or Mac                         |

Not tested: real Safari (macOS or iOS), real Android Chrome, physical devices, TalkBack and VoiceOver.

## 9. Defects found and fixed

| #   | Defect                                                      | Fix                                                                               | Regression test                                                        |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Button and selected-term text 3.71:1 (axe `color-contrast`) | Filled controls use accent-700 (`--color-action`), hover 800, pressed 900 (D-033) | axe suite                                                              |
| 2   | Text-field borders 1.38:1 against the page                  | `--color-input-border` neutral-600, 3.82:1 (D-033)                                | `a11y.spec.ts`: border contrast ≥ 3:1                                  |
| 3   | Selected term invisible in forced colours                   | `forced-colors` rules with system colours (D-034)                                 | `a11y.spec.ts`: forced colours                                         |
| 4   | Text ignored the browser's font-size setting (`px`)         | Font sizes in `rem` (D-035)                                                       | `large-text.spec.ts` (Firefox at 32px)                                 |
| 5   | At large text, the "R" prefix overlapped the value          | Left padding `calc(14px + 1em)` (30px at default)                                 | Checked by probe; covered visually by `large-text-after-360.png`       |
| 6   | At large text, the term group was clipped at 360px          | Cells wrap (`flex: 1 1 3rem`), with no empty slot                                 | `large-text.spec.ts`                                                   |
| 7   | Firefox left a partly visible focused control where it was  | `html { scroll-padding-block: 24px }` (D-036)                                     | `smoke.spec.ts` (Firefox), shown to fail without the fix (42% visible) |
| 8   | One-line error-summary links about 22px tall                | 2px vertical padding (D-039)                                                      | Target-size probe                                                      |

Each regression test was shown to catch its defect. #1 and #4 failed against the code before the fix: 24 axe violations, and a 15px label at a 32px default. #2, #3, #6 and #7 failed when their fix was temporarily reverted. #5 and #8 are layout measurements recorded above, with no automated test.

## 10. Remaining verification gaps

These are checks this environment could not perform. None of them is a known defect.

| Gap                                                  | Why                                                           | What to do                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Screen readers (NVDA, Narrator, VoiceOver, TalkBack) | NVDA not installed; Narrator's speech cannot be observed here | Run the checklist in §4                                                                                      |
| Real browser zoom                                    | The browser's zoom UI cannot be driven by Playwright          | In Chrome or Edge, press Ctrl + until 200% and then 400% (on a 1280px-wide window), and repeat the main flow |
| Real Windows high contrast                           | Only emulated                                                 | Turn on a Windows contrast theme and check that the selected term and focus rings are visible                |
| Real Safari and mobile devices                       | Not available                                                 | Open the deployed site on an iPhone and an Android phone                                                     |

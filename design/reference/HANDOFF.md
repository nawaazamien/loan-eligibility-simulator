# Tally — Loan Eligibility Simulator · Claude Code handoff

Reference files in this design project:
- `LoanSimulator.dc.html` — the live, interactive reference component (all copy, states, logic). The `<script data-dc-script>` block holds the exact constants, parser, validation messages, calculation and copy-building logic — port it directly to TypeScript.
- `Loan Simulator Board.dc.html` — every state at 1280px and 360px.
- `_ds/industry-…/styles.css` — the source of the design tokens below.

---

## 1. Product summary and scope

A single-page, client-only simulator. A customer enters take-home income, living expenses, existing debt repayments, a loan amount and a term, then selects **Calculate estimate** to see an illustrative monthly repayment, money left over, whether it fits a fictional affordability rule, and what they could change.

In scope: one page, one form, one results panel, assumptions disclosure, validation, stale-result handling, reset, example values.
Out of scope: routing, backend, auth, persistence, analytics, personal data (ID, employer, bank, contact), transaction history, any real credit logic.

Stack: React 18 + Vite + TypeScript. Styling: CSS Modules (or vanilla CSS) with a single `tokens.css` of custom properties. Tests: Vitest + React Testing Library (+ `@testing-library/user-event`, `vitest-axe` optional). Docker: multi-stage (node build → nginx static serve).

Product name: **Tally** (neutral, fictional). Always shown with a "Demo" tag.

## 2. Layout and responsive behaviour

```
<header>   Tally [Demo]                         Fictional estimates · Not a credit check (≥760px only)
<main>     H1 + intro (max-width 720px)
           grid: [ form (7fr) ] [ results (5fr), position: sticky; top: 16px ]
<footer>   demonstration disclaimer
```
- Content max-width **1160px**, centred. Header/footer borders span full width.
- Breakpoint **760px** (single breakpoint, mobile-first CSS: `@media (min-width: 760px)`).

| | < 760px | ≥ 760px |
|---|---|---|
| Horizontal page padding | 16px | 32px |
| Main padding | 24px 16px 32px | 40px 32px 48px |
| Grid | 1 column, gap 28px | `minmax(0,7fr) minmax(0,5fr)`, gap 32px, `align-items:start` |
| Card padding | 20px 18px | 28px 30px |
| H1 | 34px | 46px |
| Repayment figure | 48px | 60px |
| Input / term control max-width | 100% | 420px |
| Calculate button | grows (`flex: 1 1 auto`) | intrinsic |
| Results panel | static (not sticky) | sticky top 16px |
| Assumptions `dl` | stacked | 130px term column + value |

- No sticky/fixed elements on mobile.
- Must reflow without horizontal scroll at 320px and 200% zoom / 200% text size; use `minmax(0,…)` tracks, no fixed heights on text containers, `text-wrap: pretty` on paragraphs.

## 3. Component hierarchy

```
App
├─ SiteHeader            (wordmark, DemoTag, tagline ≥760px)
├─ PageIntro             (h1, p)
├─ SimulatorLayout       (grid)
│  ├─ LoanForm           <form noValidate aria-labelledby="form-heading">
│  │  ├─ FormHeader      (h2 "Your details", Button ghost "Use example values")
│  │  ├─ ErrorSummary    (role=alert, tabIndex=-1, links → fields)   [only after failed submit]
│  │  ├─ Fieldset "Your monthly budget"
│  │  │  ├─ CurrencyField income
│  │  │  ├─ CurrencyField expenses
│  │  │  └─ CurrencyField debt
│  │  ├─ Fieldset "The loan you'd like"
│  │  │  ├─ CurrencyField loan  + LoanSlider (range input, synced)
│  │  │  └─ TermSelector  (fieldset + 5 radios styled as segmented control)
│  │  └─ FormActions     (Button primary submit, Button secondary Reset, FormStatus role=status)
│  └─ ResultsPanel       <section aria-labelledby="results-heading">
│     ├─ h2 "Your estimate" (tabIndex=-1, focus target) + "Illustrative only"
│     ├─ EmptyState                           [no result yet]
│     ├─ StaleBanner (role=status)            [result && inputs changed]
│     ├─ OutcomeStatus (icon + title + sub)
│     ├─ RepaymentFigure
│     ├─ Explanation <p>
│     ├─ ResultSummary <dl> (4 rows)
│     ├─ IncomeBreakdown (bar aria-hidden + legend <ul>)   [not for "none"]
│     ├─ NextSteps <ul>                                    ["above" / "none"]
│     └─ AssumptionsDisclosure (button aria-expanded + region)  [always present]
├─ LiveAnnouncer (visually hidden aria-live=polite)
└─ SiteFooter
```
Pure logic in `src/lib/`: `parseAmount.ts`, `validate.ts`, `calculate.ts`, `format.ts`, `copy.ts` (result sentences/tips), `constants.ts`. Components contain no maths. State in one `useReducer` (`values`, `term`, `errors`, `submitted`, `showSummary`, `result`, `resultKey`, `assumptionsOpen`, `statusMessage`, `announcement`).

## 4. Design tokens (Industry design system)

```css
:root{
  --color-bg:#f2f2f3; --color-surface:#e9e9ea; --color-text:#1d1f20;
  --color-divider:color-mix(in srgb,#1d1f20 16%,transparent);
  --color-accent:#5980a6;
  --color-accent-100:#eef6ff; --color-accent-400:#94bce3; --color-accent-600:#597ea3;
  --color-accent-700:#416180; --color-accent-900:#1d2d3d;
  --color-neutral-100:#f5f5f8; --color-neutral-400:#b7b7ba; --color-neutral-700:#5d5d60; --color-neutral-800:#424244;
  /* functional status colours (added for this product; not decorative) */
  --color-critical:#a3392b; --color-critical-bg:#fbefec; --color-critical-border:#e0a397;
  --color-caution:#8a5a00;  --color-caution-bg:#fbf4e6;  --color-caution-border:#d9b26a;

  --font-heading:"Barlow Condensed",system-ui,sans-serif;  /* weight 600 */
  --font-body:"Barlow",system-ui,sans-serif;               /* 400 / 500 / 600 */
  --radius:0;            /* everything square */
  --border:1px solid var(--color-divider);
  --shadow:none;         /* no shadows used on this page */
}
```
- Spacing (px): 2, 4, 6, 10, 12, 14, 16, 18, 22, 28, 32, 40. Field internal gap 6; between fields 22; form sections 28.
- Type: body 15/1.55. Labels 15/500. Helper 13.5/1.45 neutral-700. Error 14/500 critical. Legend (section) 12px, 0.1em tracking, uppercase, 500, accent-700. H1 Barlow Condensed 600 46/1.05; H2 25; H3 18–20. Numbers `font-variant-numeric: tabular-nums`. Inputs 16px (prevents iOS zoom).
- Fonts: Google Fonts `Barlow:wght@400;500;600` + `Barlow+Condensed:wght@600`, `display=swap` (or self-host via `@fontsource/barlow`, `@fontsource/barlow-condensed` — preferred for Docker/offline).
- **Blueprint frame**: form card, results card and primary button get `position:relative; border:1px solid var(--color-divider)` plus four 11×11px "+" corner marks offset −6px (see `.blueprint .corner` in styles.css). Cards have **no fill and no shadow**. Implement as a `<Frame>` wrapper rendering four `aria-hidden` spans.
- Buttons: primary = accent fill, `--color-bg` text, hover accent-600, active accent-700; min-height 48, padding 0 26px, Barlow Condensed 18px. Secondary = transparent, divider border, hover `color-mix(text 7%)`. Ghost = accent-700 text, no border, hover accent 10% tint. Disabled 45% opacity (not used).
- Input: surface fill `#e9e9ea`, 1px divider border, min-height 46, padding-left 30 (for "R" prefix at left:12), hover border text 45%; error: border + 1px inset ring critical.
- Focus (all controls): `outline:2px solid var(--color-accent); outline-offset:2px` on `:focus-visible`. Never remove.
- Term segmented control: 5-column grid, 52px tall cells, number (Barlow Condensed 19) over "months" (12px). Checked = accent fill, bg-colour text. Focus ring inset (−2px).
- Range: native `<input type=range>` with `accent-color: var(--color-accent)`, height 32px.
- Status blocks: 1px border + tinted bg — within: accent-400/accent-100/ink accent-700; above: caution; none: critical.
- Breakdown bar: 14px tall, 2px gaps. Expenses neutral-400, existing debt neutral-700, new repayment accent, left over accent-100 with accent-400 border.

## 5. Exact UI copy

Header: `Tally` · tag `Demo` · `Fictional estimates · Not a credit check`
H1: `Loan eligibility simulator`
Intro: `See an illustrative estimate of what a personal loan could cost each month, and whether it fits a simple demo affordability rule. This isn't a credit check, an approval or an offer.`

Form: H2 `Your details` · ghost button `Use example values`
Section `Your monthly budget`
- `Monthly take-home income` — `The money you receive each month after tax and other deductions.`
- `Monthly living expenses` — `Rent, groceries, transport, school fees and similar costs. Don't include debt repayments.`
- `Existing monthly debt repayments` — `Repayments on current loans, credit cards and store accounts. Don't include the loan you're simulating. Enter 0 if you have none.`
Section `The loan you'd like`
- `Loan amount` — `Choose an amount between R1 000 and R250 000.` Slider end labels `R1 000` / `R250 000`.
- `Repayment term` — `Longer terms lower the monthly repayment but cost more in interest overall.` Options `12 / 24 / 36 / 48 / 60` + `months`.
Buttons: `Calculate estimate`, `Reset`.

Status messages (FormStatus, role=status):
- after Use example: `Example values added. Select Calculate estimate to see the result.`
- after Reset: `Form reset. Enter your details to calculate a new estimate.`
- stale, <760px only: `Your inputs have changed. Calculate again to update the estimate below.`
Messages clear on the next input change.

Results: H2 `Your estimate` · `Illustrative only`
Empty: `Enter your details and select Calculate estimate to see:` · `your estimated monthly repayment` · `what you'd have left each month` · `whether it fits the demo affordability limit` · `what you could change to improve it`
Outcome titles: `Within the demo affordability limit` · `Above the demo affordability limit` · `No room for an additional repayment`
Outcome sub: `An illustration based on fictional assumptions — not a credit decision.`
Figure label: `Estimated monthly repayment` · note `Includes the R69 monthly service fee · 19.5% a year, fixed (fictional)`
Explanation (templates; `{x}` formatted rand, `{pct}` = round(repayment / available × 100)):
- within: `Your estimated repayment of {repay} would use {pct}% of the {available} you have left each month after expenses and existing debt. That's within the demo limit of 40% ({limit}).`
- above: `…{pct}% of the {available} you have left each month after expenses and existing debt. The demo limit is 40% ({limit}), so this estimate is {repay − limit} a month above it.`
- none: `Your expenses and existing debt repayments ({committed}) are {−available} more than your take-home income, so this demo can't fit an additional repayment.` (when exactly equal: `…({committed}) use all of your take-home income, so…`)
Summary rows: `Loan amount` · `Repayment term` (`{n} months`) · `Left after all repayments` (`{x} a month`, may be negative with "−") · `Total repayable`.
Breakdown heading: `Where your {income} goes each month`; legend `Living expenses`, `Existing debt`, `New repayment`, `Left over` (omitted when ≤0). Overflow note (above, remaining < 0): `Your commitments and the new repayment would be {x} more than your income.`
Next steps heading `What you could try`, numbered 01–03:
- above: `Borrow less.` `Over {term} months, about {maxLoan} or less would keep the estimate within the demo limit.` (only if maxLoan ≥ R1 000) · `Choose a longer term.` `Over 60 months the estimate is {repay60} a month, {within|still above} the demo limit. You'd pay more interest overall.` (only if term < 60) · `Review your commitments.` `Lowering regular expenses or paying down existing debt increases the money you have left each month.`
- none: `Check your figures.` `Make sure income is your take-home amount and expenses don't also include debt repayments.` · `Review your commitments.` (as above)
- footnote: `These are illustrations only. Changes don't guarantee you'd qualify for a real loan.`
Stale banner: **`Your inputs have changed.`** `The estimate below is out of date.` + secondary button `Recalculate estimate`. Stale outcome sub becomes `Previous estimate — recalculate to update.`
Assumptions toggle: `How this estimate is calculated`
- `Interest rate` — `19.5% a year, fixed for the full term. Interest is calculated monthly on the outstanding balance.`
- `Fees` — `A R69 monthly service fee is added to every repayment. No initiation fee is included.`
- `Affordability rule` — `Take-home income minus living expenses and existing debt gives the money you have left. The new repayment may use up to 40% of it.`
- `Outcomes` — `Within the limit, above the limit, or no room when expenses and existing debt use all of your income.`
- `Not considered` — `Credit history, credit insurance, rate changes, employment or any credit bureau information.`
- footnote `All rates, fees and rules are fictional and used for demonstration only.`
Footer: `Tally is a demonstration project built for a front-end engineering assessment. It isn't affiliated with any bank or lender, doesn't store your information and doesn't perform credit checks.`

## 6. Form interaction and validation

Defaults: income/expenses/debt empty; loan `50 000`; term 36. Example values: 28 500 / 14 200 / 3 150 / 60 000 / 48 months.

Inputs: `type="text" inputMode="decimal" autoComplete="off"`, visible "R" prefix (`aria-hidden`; label already says rand context — add "in rand" to sr text if desired). Never block typing.

**Parsing** (`parseAmount`): trim → strip leading `R`/`r` → remove spaces/NBSP → remove commas followed by exactly 3 digits (grouping) → treat remaining single `,` as decimal → must match `^-?\d+(\.\d{1,2})?$`. Results: `empty | malformed | negative | ok(n)`.
**Formatting on blur** (valid only): group thousands with NBSP, keep cents if present: `28500` → `28 500`. Invalid text is left exactly as typed.
**Display currency**: `R` + NBSP-grouped integer (`R28 500`), repayments with cents `R1 878.96`, negatives `−R398` (U+2212). Do not use `Intl` en-ZA (it outputs comma decimals); format manually and unit-test.

**Rules & messages** (checked in this order):
| Field | empty | malformed | negative | range |
|---|---|---|---|---|
| income | `Enter your monthly take-home income.` | `Use numbers only, for example 18 500.` | `Enter an amount of R0 or more.` | 1 000–1 000 000: `Enter an amount between R1 000 and R1 000 000.` |
| expenses | `Enter your monthly living expenses, or 0 if you have none.` | same | same | ≤1 000 000: `Enter an amount up to R1 000 000.` |
| debt | `Enter your existing debt repayments, or 0 if you have none.` | same | same | same as expenses |
| loan | `Enter the loan amount you would like.` | same | same | 1 000–250 000: `Enter an amount between R1 000 and R250 000.` |

Timing:
- No validation or calculation while typing.
- On submit: format all valid fields, validate all. If any errors → show ErrorSummary (`Check {n} field(s) before calculating`, list of error messages as links that focus the field) and move focus to it. Values are never cleared.
- After a failed submit, each field re-validates on blur; errors clear individually; summary hides when error count reaches 0.
- Error presentation: message (alert-circle icon + text) sits between helper and input; input `aria-invalid="true"`, `aria-describedby="{id}-error {id}-hint"`, critical border + ring.

Slider ↔ input: range 1 000–250 000, step 1 000. Moving slider writes the grouped value to the text field. Typed valid value moves the slider (rounded to step, clamped); invalid/out-of-range text leaves the slider at the clamp/min. Text field is the source of truth (allows non-step values like 52 500).

Term: native radios in a `fieldset`/`legend`; arrow keys move selection.

Use example: fills values + term 48, clears errors/summary, sets status message. Does **not** calculate.
Reset: restores defaults, clears errors, result, summary, collapses nothing else (assumptions state may stay), sets reset status message, moves focus to income field.
Enter key in any field submits.

## 7. Result states and stale behaviour

```
available = income − expenses − debt
r         = 0.195 / 12
repayment = loan × r / (1 − (1 + r)^−term) + 69
limit     = max(0, 0.40 × available)
outcome   = available ≤ 0 ? "none" : repayment ≤ limit ? "within" : "above"
remaining = available − repayment
total     = repayment × term
maxLoan   = limit > 69 ? floor((limit − 69) / factor(term) / 1000) × 1000 : 0
repay60   = loan × factor(60) + 69
```
Round only for display. Unit-test all three outcomes plus boundaries (repayment == limit → within; available == 0 → none).

Reference outputs: example (28 500/14 200/3 150/60 000/48) → within, ~R1 879/mo. Above preset (18 000/11 500/2 400/120 000/36) → above. None preset (12 000/9 800/2 600/20 000/24) → none.

States: initial (EmptyState) · within · above (+ next steps + overflow note if remaining < 0) · none (no breakdown bar, next steps) · stale.
**Stale**: store `resultKey` = normalised parsed values + term at calculation. On every render compare to current; if different → show StaleBanner, recolour outcome block to neutral, sub text "Previous estimate…", dim breakdown bar to 45% opacity (text stays full contrast), on mobile also show the FormStatus note. The old result stays visible until recalculation. If a recalculation fails validation, the stale result remains, still marked stale.
No loading states, no transitions on results. Never show figures before a successful calculation.

After successful calculation: set `announcement` = `Estimate updated. {outcome title}. Estimated monthly repayment {R x.xx}.` into the polite live region; move focus to results H2 (`tabIndex=-1`, `preventScroll`), and on <760px scroll it into view with `window.scrollTo` (smooth unless `prefers-reduced-motion: reduce`).

## 8. Accessibility (WCAG 2.2 AA)

- Persistent visible `<label for>` on every input; helper text linked via `aria-describedby`; groups in `fieldset/legend`.
- `form noValidate` + custom validation; ErrorSummary `role="alert"`, focused on failed submit, links focus fields.
- Status never by colour alone: icon + text title on every outcome; breakdown bar `aria-hidden` with full text legend.
- Disclosure: `<button aria-expanded aria-controls>` + region with `hidden` when collapsed. Chevron is decorative.
- Range input: `aria-label="Loan amount slider"`, `aria-valuetext="R50 000"`; the text input is the precise alternative.
- Target sizes ≥ 44×44 (inputs 46, buttons 48, term cells 52, disclosure 48).
- Contrast: body text ≥ 4.5:1 (text #1d1f20, neutral-700 #5d5d60, accent-700 #416180, critical #a3392b, caution #8a5a00 on #f2f2f3). Accent #5980a6 only for fills/large/UI.
- Focus visible on every control; focus not obscured (nothing sticky on mobile; desktop sticky panel doesn't overlap form).
- `prefers-reduced-motion`: disable smooth scroll/transitions.
- Reflow at 320px / 400% zoom; text spacing overrides don't clip.
- `<html lang="en-ZA">`, page `<title>Loan eligibility simulator · Tally (demo)</title>`.
- Test: RTL queries by role/label; `vitest-axe` on each state; manual keyboard pass.

## 9. Assets and icons

- Icons: **Lucide** (`lucide-react`), `strokeWidth={1.5}`, `aria-hidden`: `CircleCheck` (within), `TriangleAlert` (above), `CircleMinus` (none), `CircleAlert` (errors), `RefreshCw` (stale), `Info` (form status), `Calculator` (empty state, 32px accent), `ChevronDown` (disclosure, rotates 180°).
- Fonts: Barlow, Barlow Condensed (OFL) via `@fontsource`.
- No images, logos or illustrations. Wordmark is text.
- Favicon: simple text/letter SVG "T" on accent (optional).

## 10. Assumptions and open decisions

- Rate 19.5%, fee R69, 40% rule, limits and terms are fictional placeholders — keep them in `constants.ts` and document in README.
- Number format: space-grouped rand with point decimals (common in SA banking UIs); commas accepted as input grouping.
- Design system uses transparent line-drawn cards on a light grey ground rather than white filled cards — intentional per the Industry system. Status colours (critical, caution) were added as functional colours only.
- Unresolved: whether `Total repayable` should exclude fees (currently includes); whether to persist inputs in `sessionStorage` (recommend no).

## 11. Implementation guidance

```
src/
  main.tsx  App.tsx  styles/tokens.css  styles/global.css
  components/{SiteHeader,PageIntro,LoanForm,CurrencyField,LoanSlider,TermSelector,ErrorSummary,FormActions,ResultsPanel,OutcomeStatus,ResultSummary,IncomeBreakdown,NextSteps,AssumptionsDisclosure,Frame,Button}.tsx (+ .module.css)
  lib/{constants,parseAmount,validate,calculate,format,copy}.ts
  state/simulatorReducer.ts
  __tests__/ lib unit tests + App integration tests (each of the 10 states)
Dockerfile  nginx.conf  README.md
```
- Keep `lib/` pure and 100% unit-tested; that's the interview story.
- IDs via `useId()`.
- README: run (`npm ci && npm run dev`), test (`npm test`), build, Docker (`docker build -t tally . && docker run -p 8080:80 tally`), the fictional model, a11y notes, trade-offs.

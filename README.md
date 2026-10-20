# Loan eligibility simulator (Tally — demo)

A responsive, client-only web app where a customer enters their monthly income, expenses and existing debt, plus a loan amount and term, and sees an **illustrative** estimate of the monthly repayment and whether it fits a simple **fictional** affordability rule.

Built as a recruitment assignment for a Front-End Software Engineer role. "Tally" is a fictional product name, and the app is not affiliated with any bank or lender.

> **Fictional data disclaimer.** Every rate, fee, limit and rule used here (19.5% a year, a R69 monthly fee, a 40% affordability limit) is made up for demonstration. The app is not a credit check, an approval, an offer, or any lender's or regulator's affordability assessment. It stores nothing and sends nothing anywhere.

## Status

| Phase | Scope                                                        | State                                                                                                                                       |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Design import, tooling, container, application shell         | **Done**, verified locally and in CI ([record](docs/PROJECT_PLAN.md#phase-0--design-import-foundation-tooling-container-application-shell)) |
| 1     | Responsive form and results UI matching the design           | **Done** ([record](docs/PROJECT_PLAN.md#phase-1--responsive-interface-matching-the-design))                                                 |
| 2     | Simulation model, validation, result and stale states, reset | **Done** ([record](docs/PROJECT_PLAN.md#phase-2--deterministic-simulation-validation-result-states-stale-results-reset))                    |
| 3     | Accessibility and responsive refinement, test coverage       | **Done**, with manual verification gaps ([review](docs/validation/phase-3/ACCESSIBILITY_REVIEW.md))                                         |
| 4     | Production verification and submission readiness             | Planned                                                                                                                                     |

**What works now:**

- The page from the approved design: header with the Demo tag, title and intro, the two-panel layout with the design's "blueprint" frames (side by side from 760 px, stacked below), and the footer.
- The details form: take-home income, living expenses, existing debt repayments and loan amount as rand fields with visible labels and helper text, plus the repayment term as a segmented set of radio buttons. Amounts keep exactly what you type and are tidied only when you leave a field (`28500` → `28 500`). Empty or malformed text is never turned into zero.
- A loan slider kept in step with the loan field, "Use example values", Reset (restores the defaults and returns focus to the first field), and the "How this estimate is calculated" disclosure.
- **Calculate estimate** (button or Enter): validates the whole form, then shows the estimated monthly repayment and one of three outcomes: within the demo affordability limit, above it (with a shortfall note and next steps), or no room for an additional repayment. It also shows a plain-language explanation, a summary, a breakdown of where the income goes, and next steps where they help.
- Validation: a linked error summary (which receives focus) and inline errors on each field, with `aria-invalid`. Values are never cleared. After a failed attempt, fields re-check when you leave them, never while you type.
- Freshness: change any input after calculating and the estimate stays visible but is marked out of date, with a Recalculate button (and a note under the form on phones). Changing the values back makes it current again; formatting alone (`28500` vs `28 500`) never does.
- A short polite screen-reader announcement after each successful calculation, and focus on the estimate heading (scrolled into view on phones, without smooth scrolling if reduced motion is set).

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Stack

React 19 · Vite 8 · TypeScript 6 (strict) · CSS Modules with design tokens · Vitest 5 + React Testing Library · Playwright · ESLint 10 + typescript-eslint · Prettier · nginx (unprivileged) in Docker · GitHub Actions.

## Prerequisites

- Node.js 24 (see `.nvmrc`; 22.12 or later works) and npm 11
- Docker, for the container
- For browser tests: Playwright's Chromium (`npx playwright install chromium`)

## Install and develop

```sh
npm ci            # install exactly what package-lock.json specifies
npm run dev       # development server at http://localhost:5173
```

## Build and preview the production bundle

```sh
npm run build     # type-checks, then writes the static site to dist/
npm run preview   # serves dist/ at http://127.0.0.1:4173
```

## Test and check

```sh
npm run typecheck     # tsc, strict
npm run lint          # ESLint (type-aware)
npm run format:check  # Prettier
npm test              # Vitest unit and component tests
npm run test:coverage # the same, with a coverage report in coverage/ and 100% thresholds on the model and reducer
npm run test:e2e      # Playwright against the production bundle: Chromium at 1280/360/320 px, Firefox and WebKit smoke
npm run test:a11y     # only the axe accessibility checks (Chromium)
npm run check         # typecheck + lint + format:check + test + build
```

Browser tests need Playwright's browsers once: `npx playwright install chromium firefox webkit`.

To run the browser tests against an already-running server, such as the Docker container:

```sh
E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

## Docker

The image builds the app with Node, then serves only the static files from an unprivileged nginx. The container runs as a non-root user and listens on **port 8080**.

```sh
docker build -t loan-eligibility-simulator .
docker run --rm -p 8080:8080 loan-eligibility-simulator
# open http://localhost:8080
```

`index.html` is served with `Cache-Control: no-cache`, so new deploys show up immediately. Content-hashed files under `/assets/` are cached for a year. Every response carries a strict Content Security Policy.

## Architecture

```
src/
  main.tsx                     entry: fonts, global styles, React root
  app/App.tsx                  page composition (header, intro, simulator, footer)
  components/                  shared presentational pieces: SiteHeader, SiteFooter, Button, FrameCorners
  features/loan-simulator/
    LoanSimulator.tsx          the 7/5 grid; owns the form state
    formState.ts               pure reducer: edits, blur, submit, the last result and its freshness
    LoanForm.tsx               the details form: ErrorSummary, CurrencyField, LoanAmountField, TermSelector
    ResultsPanel.tsx           the estimate panel: EstimateDetails, out-of-date banner, AssumptionsDisclosure
    model/                     pure functions, no React: parsing, validation, calculation, formatting, wording
  styles/                      tokens.css (design tokens), global.css, cx helper
  test/                        Vitest setup and test helpers
e2e/                           Playwright browser tests
nginx/                         runtime server config and security headers
design/reference/              verbatim copy of the approved design (reference only, not bundled)
docs/                          plan, design handoff, decisions, simulation model
docs/validation/               screenshots comparing each phase's build with the rendered reference
```

Parsing, validation, the calculation, formatting and all result wording are pure TypeScript functions in `model/`, kept out of the React components and unit-tested. Components contain no lending maths.

## How the estimate is calculated (fictional)

| Assumption    | Value                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Interest      | 19.5% a year, fixed, compounded monthly (r = 0.195 ÷ 12)                                            |
| Fee           | R69 added to every monthly repayment; no initiation fee                                             |
| Affordability | the repayment may use up to 40% of income minus living expenses and existing debt                   |
| Limits        | income R1 000 – R1 000 000; expenses and debt R0 – R1 000 000; loan R1 000 – R250 000; 12–60 months |

```
available  = income − expenses − debt
repayment  = round_half_up( loan × r ÷ (1 − (1 + r)^−months) ) + R69     (to the cent)
outcome    = "no room"  if available ≤ 0
             "within"   if 5 × repayment ≤ 2 × available                  (exactly 40%, in integers)
             "above"    otherwise
remaining  = available − repayment          (shown as a negative when commitments exceed income)
total      = repayment × months             (fees included)
```

Money is integer cents throughout; the only floating-point step is the amortisation factor, rounded once. All eight reference cases in [docs/SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md) were checked independently and are unit tests.

## Documentation

- [Project plan](docs/PROJECT_PLAN.md): phases, acceptance criteria, where each requirement comes from
- [Design handoff](docs/DESIGN_HANDOFF.md): what the imported design specifies
- [Decisions](docs/DECISIONS.md): technical and product decisions, with reasons
- [Simulation model](docs/SIMULATION_MODEL.md): the fictional model, rounding rules and verified reference cases
- [Accessibility review](docs/validation/phase-3/ACCESSIBILITY_REVIEW.md): what was checked, how, what was fixed, and what still needs a person

## Current limitations

- Accessibility: automated axe checks passed for every tested state, and keyboard, contrast, zoom emulation, text spacing, larger browser text and forced colours were reviewed and fixed where needed ([review](docs/validation/phase-3/ACCESSIBILITY_REVIEW.md)). **No screen-reader pass has been done yet**, and real browser zoom, real Windows high contrast, Safari and physical phones remain manual checks (checklist in the review). This is not a WCAG conformance claim.
- WebKit coverage is Playwright's WebKit build, not Safari on a real iPhone or Mac.
- Light theme only, as designed.
- No licence has been chosen yet. That is the repository owner's decision.

# Loan eligibility simulator (Tally — demo)

A responsive, client-only web app where a customer enters their monthly income, expenses and existing debt, plus a loan amount and term, and sees an **illustrative** estimate of the monthly repayment and whether it fits a simple **fictional** affordability rule.

Built as a recruitment assignment for a Front-End Software Engineer role. "Tally" is a fictional product name, and the app is not affiliated with any bank or lender.

> **Fictional data disclaimer.** Every rate, fee, limit and rule used here (19.5% a year, a R69 monthly fee, a 40% affordability limit) is made up for demonstration. The app is not a credit check, an approval, an offer, or any lender's or regulator's affordability assessment. It stores nothing and sends nothing anywhere.

## Status

| Phase | Scope                                                        | State                                                                                                                                       |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Design import, tooling, container, application shell         | **Done**, verified locally and in CI ([record](docs/PROJECT_PLAN.md#phase-0--design-import-foundation-tooling-container-application-shell)) |
| 1     | Responsive form and results UI matching the design           | **Done** ([record](docs/PROJECT_PLAN.md#phase-1--responsive-interface-matching-the-design))                                                 |
| 2     | Simulation model, validation, result and stale states, reset | Planned                                                                                                                                     |
| 3     | Accessibility and responsive refinement, test coverage       | Planned                                                                                                                                     |
| 4     | Production verification and submission readiness             | Planned                                                                                                                                     |

**What works now:**

- The page from the approved design: header with the Demo tag, title and intro, the two-panel layout with the design's "blueprint" frames (side by side from 760 px, stacked below), and the footer.
- The details form: take-home income, living expenses, existing debt repayments and loan amount as rand fields with visible labels and helper text, plus the repayment term as a segmented set of radio buttons. Amounts keep exactly what you type and are tidied only when you leave a field (`28500` → `28 500`). Empty or malformed text is never turned into zero.
- A loan slider kept in step with the loan field, "Use example values", Reset (restores the defaults and returns focus to the first field), and the "How this estimate is calculated" disclosure.
- The estimate panel's initial state, which explains what will appear once an estimate is calculated.

> **Temporary limitation (development version):** **Calculate estimate** is disabled, with a visible note saying calculation isn't available yet. No estimate, repayment or eligibility outcome is calculated or shown anywhere. The calculation, validation and result states are added in Phase 2, which also enables the button.

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
npm run test:e2e      # Playwright: builds, serves the production bundle, tests at 1280/360/320 px
npm run check         # typecheck + lint + format:check + test + build
```

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
    formState.ts               pure reducer for the form (edit, blur, slide, term, example, reset)
    LoanForm.tsx               the details form: CurrencyField, LoanAmountField (+ slider), TermSelector
    ResultsPanel.tsx           the estimate panel and AssumptionsDisclosure
    model/                     pure functions, no React: amount parsing, formatting, slider mapping, limits
  styles/                      tokens.css (design tokens), global.css, cx helper
  test/                        Vitest setup and test helpers
e2e/                           Playwright browser tests
nginx/                         runtime server config and security headers
design/reference/              verbatim copy of the approved design (reference only, not bundled)
docs/                          plan, design handoff, decisions, simulation model
docs/validation/phase-1/       screenshots comparing the build with the rendered reference
```

Parsing and formatting are already pure TypeScript functions in `model/`, kept out of the React components and unit-tested. The calculation will join them in Phase 2. Money is handled in integer cents, so boundary decisions never depend on floating-point error. The proposed model, with worked examples you can check by hand, is in [docs/SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md).

## Documentation

- [Project plan](docs/PROJECT_PLAN.md): phases, acceptance criteria, where each requirement comes from
- [Design handoff](docs/DESIGN_HANDOFF.md): what the imported design specifies
- [Decisions](docs/DECISIONS.md): technical and product decisions, with reasons
- [Simulation model](docs/SIMULATION_MODEL.md): the proposed fictional model and reference cases

## Current limitations

- Calculation, validation messages, result states and the stale-result handling are not implemented yet (Phase 2). Until then, **Calculate estimate** is disabled and says so.
- Accessibility is built in (native labelled controls, fieldsets, keyboard operation, visible focus), but the full WCAG 2.2 audit, including automated axe checks and zoom testing, is planned for Phase 3.
- Light theme only, as designed.
- No licence has been chosen yet. That is the repository owner's decision.

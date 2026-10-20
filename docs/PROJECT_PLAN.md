# Project plan — loan-eligibility-simulator

A responsive, client-only UI where a customer enters income, expenses and a desired loan amount (plus existing debt and a term, per the design) and sees an **estimated**, clearly fictional eligibility result. Built as a front-end engineering assessment.

Work proceeds one phase at a time: implement, validate, commit, report, stop.

## Requirement sources

| Requirement                                                                                                                           | Source                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Responsive UI for income, expenses and loan amount, showing estimated eligibility from mocked assumptions                             | **Employer**                                        |
| Production-grade implementation                                                                                                       | **Employer**                                        |
| Runnable Dockerfile that builds and runs the app                                                                                      | **Employer**                                        |
| README covering build, run and test                                                                                                   | **Employer**                                        |
| Public GitHub repository for submission                                                                                               | **Employer**                                        |
| React, Vite, strict TypeScript, Vitest + RTL, Playwright, ESLint/Prettier, CI                                                         | **Employer** (engineering brief)                    |
| Fictional assumptions only; no implied approval, offer or bureau check; no personal data persistence                                  | **Employer** (engineering brief)                    |
| Product "Tally" + Demo tag, layout, tokens, typography, copy, states, interactions, the 19.5% / R69 / 40% model, debt and term inputs | **Design** ([DESIGN_HANDOFF.md](DESIGN_HANDOFF.md)) |
| Stack versions, folder structure, integer-cent arithmetic, nginx runtime, caching, CSP, test strategy                                 | **Implementation** ([DECISIONS.md](DECISIONS.md))   |

## Phases

### Phase 0 — Design import, foundation, tooling, container, application shell

**Status:** complete. All acceptance criteria are verified; see the validation record below.

**Scope:** import and document the design; create AGENTS.md, this plan, DESIGN_HANDOFF, DECISIONS and SIMULATION_MODEL; set up the Vite + React + strict TS project with lint, format, unit and browser tests; add a multi-stage Dockerfile with an nginx config; add CI; write an initial README. Build the shell: header, intro, footer, tokens, fonts, and the two framed panels with placeholders.

**Acceptance criteria**

- The design was read through the Claude Design MCP. Source files are stored in `design/reference/`, and the summary is in DESIGN_HANDOFF.
- The shell matches the reference's header, type, colours, frame treatment and 7/5 to 1-column grid at 1280 and 360 px.
- There is no horizontal overflow at 320, 360 or 1280 px, and no console errors.
- All scripts work: dev, build, preview, typecheck, lint, format:check, test, test:e2e.
- The Docker image builds, runs as non-root, serves the app and its assets, `index.html` is `no-cache`, and hashed assets are immutable.
- Placeholders are clearly marked, and no numbers are shown as results.

**Validation:** `npm ci`, `npm run check`, `npm run test:e2e` (preview and container), Docker build and run smoke test.
**Depends on:** design access.

**Validation record (2026-10-19)**

_Local run_: commit `f65b95a`, Windows 11, Node 24.18.0, npm 11.16.0. It ran in a fresh `git clone` of the repository, because the main working copy's `node_modules` was locked by a running dev server.

| Check                                                        | Result                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                     | **Passed**: 238 packages, 0 vulnerabilities                                                                                                                                                             |
| `npm run check` (typecheck, lint, format:check, test, build) | **Passed**: Vitest 4/4 tests in 1 file; build 222.51 kB JS (69.72 kB gzip), 5.39 kB CSS                                                                                                                 |
| `npm run test:e2e` (production preview)                      | **Passed**: 6/6 (2 tests × 1280, 360 and 320 px). The first attempt failed only because Playwright's Chromium was not installed locally; after `npx playwright install chromium` all passed             |
| `npm run dev`                                                | **Passed**: served the page and transformed `src/main.tsx` (HTTP 200)                                                                                                                                   |
| `npm run preview`                                            | **Passed**: used as the server for the e2e run above                                                                                                                                                    |
| Docker (local)                                               | **Not run, blocked by the environment**: the local Docker Desktop engine did not respond (`docker version` / `docker info` timed out on both contexts). The container is verified in CI instead (below) |

_CI run_: GitHub Actions [run 39287506023](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39287506023) on commit `de881ef` (ubuntu-latest). Every job passed.

| Job                                 | Result                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static checks, unit tests and build | **Passed**: `npm ci`, typecheck, lint, format:check, unit tests, production build                                                                                                                                                                                                                                                                                         |
| Browser tests (production preview)  | **Passed**: 6/6                                                                                                                                                                                                                                                                                                                                                           |
| Docker image build and smoke test   | **Passed**: image builds; the container starts and runs as uid 101; `index.html` and every referenced asset return 200; `index.html` is `no-cache`; hashed assets are `public, max-age=31536000, immutable`; CSP, nosniff, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` are present; unknown paths return 404; Playwright 6/6 against the running container |

The container acceptance criteria are verified in CI, not on the local machine.

### Phase 1 — Responsive interface matching the design

**Scope:** static and interactive UI with no calculation. Covers the LoanForm (header with "Use example values", two fieldsets, four CurrencyFields with the R prefix and helper text, the loan slider synced with the text field, and the TermSelector segmented radios) and FormActions (primary framed button, secondary Reset, FormStatus region). Adds the ResultsPanel EmptyState and the AssumptionsDisclosure, which works because it is static copy, plus Lucide icons (`lucide-react`). The live-region element is created. Inputs keep raw text in state, and blur formatting may land here if the parser is introduced early. Otherwise it moves to Phase 2.

**Acceptance criteria**

- Visual parity with board states 1a, 1h layout, 1i (disclosure) and 1j at 1280 and 360 px.
- Every control is native and labelled, with helper text linked via `aria-describedby`.
- Term radios work with the arrow keys, the slider and text field stay in sync, and focus is visible on every control.
- Example values fill the fields without calculating, and Reset restores defaults and focuses income.
- No figures appear in the results panel.

**Validation:** unit and component tests for field wiring, slider sync, example and reset behaviour, and the disclosure; Playwright layout and overflow checks for 320, 360 and 1280 px; screenshot comparison against the reference renders; lint, typecheck and build.
**Depends on:** Phase 0.

**Status:** complete. Verified locally and in CI; see the validation record.

**Validation record (2026-10-19)**

_Where_: a fresh clone at `D:\Projects\loan-eligibility-simulator-phase1` (Windows 11, Node 24.18.0, npm 11.16.0), because the main working copy's `node_modules` was still locked by a running dev server. Started from `bcd90af`.

| Check                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                     | **Passed**                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run check` (typecheck, lint, format:check, test, build) | **Passed**: Vitest 82/82 tests in 6 files (parser, formatting, slider mapping, form reducer, simulator integration, app shell)                                                                                                                                                                                                                                                               |
| `npm run test:e2e` (production preview)                      | **Passed**: 25 passed, 2 skipped. The shell (2 tests) and form (6 tests) specs run at 1280, 360 and 320 px. A breakpoint test at 759/760 px runs in the desktop project only: it sets its own viewport, so it is skipped in the two mobile projects                                                                                                                                          |
| Design comparison                                            | **Done against rendered reference screens**: `LoanSimulator.dc.html` rendered through its own preview runtime in headless Chromium, compared with the production build at 1280 and 360 px, in the initial state and after "Use example values" with the assumptions expanded. The implementation was also captured at 320 and 760 px. See [validation/phase-1](validation/phase-1/README.md) |
| Keyboard pass (Chromium, 1280 px)                            | **Passed**: Tab order is Use example values → four amount fields → slider → term group (one stop) → Reset → assumptions toggle. The disabled Calculate button is skipped. Focus is visible on every stop, including the selected term cell (D-022)                                                                                                                                           |

_CI run_: GitHub Actions [run 39297094657](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39297094657) on commit `44e3a43` (ubuntu-latest). Every job passed.

| Job                                 | Result                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static checks, unit tests and build | **Passed**                                                                                                                                                                               |
| Browser tests (production preview)  | **Passed**: 25 passed, 2 skipped                                                                                                                                                         |
| Docker image build and smoke test   | **Passed**: image build, uid 101, assets, `no-cache` index, `immutable` assets, CSP and security headers, 404, and the browser suite against the running container: 25 passed, 2 skipped |

**Acceptance criteria**

| Criterion                                                                      | Result                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual parity with 1a, 1h, 1i and 1j at 1280 and 360 px                        | **Met**, with the deviations listed in [validation/phase-1](validation/phase-1/README.md): the disabled Calculate button and its note (D-018), the shorter example message (D-020), and corner marks kept on the mobile estimate panel (D-024) |
| Native, labelled controls with helper text linked via `aria-describedby`       | **Met**: component tests assert every name and description                                                                                                                                                                                     |
| Term radios work with arrow keys; slider and field stay in sync; focus visible | **Met**: component and browser tests, plus the keyboard pass                                                                                                                                                                                   |
| Example fills without calculating; Reset restores defaults and focuses income  | **Met**                                                                                                                                                                                                                                        |
| No figures in the results panel                                                | **Met**: unit and browser tests check for any rand figure other than the fictional R69 fee quoted in the assumptions copy                                                                                                                      |

**Scope change:** the live-region element listed in the scope moves to Phase 2. The Phase 1 brief reserves result announcements for Phase 2, and a live region with nothing to announce adds nothing. The form's `role="status"` region (example and reset messages) is in place.

### Phase 2 — Deterministic simulation, validation, result states, stale results, reset

**Scope:** the pure model in `src/features/loan-simulator/model/` (constants, parseAmount, validate, calculate, format, copy) exactly as specified in [SIMULATION_MODEL.md](SIMULATION_MODEL.md). A reducer for form state. Submit validation with an ErrorSummary and inline errors, then re-validation on blur. Result states (within, above, none) with the outcome block, figure, explanation, summary `dl`, income breakdown and next steps. Stale detection by normalised key, recalculation, the mobile stale note, the live announcement, focus and scroll to results, and full Reset.

**Acceptance criteria**

- All 8 reference cases and the boundary list in SIMULATION_MODEL §6–7 pass as unit tests.
- Every message and template string matches the handoff verbatim.
- Board states 1b–1g and 1k–1m reproduce at both widths.
- The model module has no React imports. It has full branch coverage, and components contain no maths.

**Validation:** Vitest model suite with coverage report, RTL integration tests for each state, Playwright journeys (calculate, edit to stale, recalculate, invalid submit, reset).
**Depends on:** Phase 1.

**Status:** complete. Verified locally and in CI; see the validation record.

**Validation record (2026-10-19)**

_Where_: the clean checkout at `D:\Projects\loan-eligibility-simulator-phase1` (Windows 11, Node 24.18.0, npm 11.16.0), started from `5732b61`.

| Check                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference cases                                              | **Verified independently**: all 8 cases in SIMULATION_MODEL §6 and the case 2 derived values (maxLoan R42 000, R3 214.97 over 60 months) re-derived with 50-digit decimal arithmetic in Python before the TypeScript existed. All matched; no correction was needed                                                                                                                                                                                                                                                 |
| `npm run check` (typecheck, lint, format:check, test, build) | **Passed**: Vitest 161/161 tests in 9 files: model (calculation, validation, wording, parsing, formatting, slider mapping), reducer, simulator integration, app shell                                                                                                                                                                                                                                                                                                                                               |
| Mutation check                                               | **Passed**: making the 40% boundary exclusive failed 3 tests; dropping the R69 fee failed 14                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run test:e2e` (production preview)                      | **Passed**: 43 passed, 2 skipped. Shell (2), form (5) and estimate (7) specs at 1280, 360 and 320 px, plus the 759/760 px breakpoint test in the desktop project only                                                                                                                                                                                                                                                                                                                                               |
| Design comparison                                            | **Done against rendered reference screens**: the live `LoanSimulator.dc.html` and the production build were driven through the same steps (within, above, no room, out of date, invalid) at 1280 and 360 px. The build was also checked at 320 px with the largest figures (R1 000 000 income, R250 000 over 12 months), a shortfall, errors and the expanded assumptions. Figures are identical in both, and focus lands in the same place after each step. See [validation/phase-2](validation/phase-2/README.md) |

_CI run_: GitHub Actions [run 39329319137](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39329319137) on commit `872aa0f` (ubuntu-latest). Every job passed.

| Job                                 | Result                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static checks, unit tests and build | **Passed**: Vitest 161/161 in 9 files                                                                                                                                                    |
| Browser tests (production preview)  | **Passed**: 43 passed, 2 skipped                                                                                                                                                         |
| Docker image build and smoke test   | **Passed**: image build, uid 101, assets, `no-cache` index, `immutable` assets, CSP and security headers, 404, and the browser suite against the running container: 43 passed, 2 skipped |

Local Docker was not used in this phase; the container is verified in CI.

**Acceptance criteria**

| Criterion                                                         | Result                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 8 reference cases and the §7 boundary list pass as unit tests | **Met**                                                                                                                                                                                                                                                                                                                                                    |
| Every message and template string matches the handoff verbatim    | **Met**, except the sub-R1 gap shown in cents (D-028)                                                                                                                                                                                                                                                                                                      |
| Board states 1b–1g and 1k–1m reproduce at both widths             | **Met**: within, above, no room, empty and invalid fields, out of date, and their mobile versions                                                                                                                                                                                                                                                          |
| The model has no React imports, and components contain no maths   | **Met**: `model/` imports nothing from React; components only render `describeEstimate` output                                                                                                                                                                                                                                                             |
| Full branch coverage of the model                                 | **Met**: 100% of statements, branches, functions and lines in `model/` and `formState.ts` (175 statements, 114 branches), measured with `@vitest/coverage-v8` 5.0.5 installed without saving. The first measurement found two untested branches (tips left out when they do not apply); tests were added. Committed coverage tooling is in Phase 3's scope |

**Scope notes:** the live region planned for Phase 1 is added here (D-027).

### Phase 3 — Accessibility, responsive refinement, meaningful automated coverage

**Scope:** WCAG 2.2 AA pass. Automated axe checks (via `@axe-core/playwright` or `vitest-axe`) on every state. Keyboard-only journeys, focus order and focus-not-obscured with the sticky desktop panel. 200% and 400% zoom and text-spacing checks. Reduced motion. Contrast check of every token pair in use. Screen-reader announcements (live region, `role=alert`, `role=status`). Fixes for anything found.

**Acceptance criteria:** zero axe violations across all states; manual keyboard and screen-reader checklist recorded in docs; reflow at 320 px and 400% zoom with no loss of content; tests cover behaviour rather than implementation details.

**Validation:** axe suites, Playwright keyboard tests, a documented manual pass (NVDA or Narrator on Windows, plus a mobile emulation check).
**Depends on:** Phase 2.

**Status:** complete, **with manual verification gaps**: no screen-reader pass, and no real browser zoom, real Windows high contrast, Safari or physical-device checks. These need a person; the checklist is in the review. The full record is [validation/phase-3/ACCESSIBILITY_REVIEW.md](validation/phase-3/ACCESSIBILITY_REVIEW.md).

**Validation record (2026-10-20)**, in `D:\Projects\loan-eligibility-simulator-phase1`, started from `f77d372`:

| Check                                                          | Result                                                                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axe (`npm run test:a11y`)                                      | First run: 24 `color-contrast` failures (two elements). After the fix: **24/24 passed** (8 states × 1280/360/320 px), whole page, no rules disabled                          |
| `npm run check`                                                | **Passed**: Vitest 164/164 in 9 files                                                                                                                                        |
| `npm run test:coverage`                                        | **Passed**: model and reducer 100% (thresholds enforced); whole app 99.6% statements, 99.4% branches                                                                         |
| `npm run test:e2e` (production preview, all projects)          | **Passed**: 89 passed, 4 skipped (intentional, project-specific). Chromium ×3 viewports, Firefox smoke, WebKit smoke, Firefox at a 32 px default font                        |
| Keyboard review                                                | **Passed** in 4 states × 7 configurations: logical order, exact Shift+Tab reverse, no traps, focus always visible and never covered. One Firefox scroll defect fixed (D-036) |
| Zoom and reflow                                                | 200% and 400% **emulated** (device scale; the browser zoom UI cannot be automated), plus 320/360 px, phone landscape and a short desktop: no overflow or lost content        |
| Text spacing (1.4.12)                                          | **Passed** in every state and configuration, with a positive control                                                                                                         |
| Contrast                                                       | Every pair measured; 2 failures fixed (D-033)                                                                                                                                |
| Forced colours, browser text size, reduced motion, target size | 2 defects fixed (D-034, D-035); reduced motion and target sizes passed                                                                                                       |
| Screen readers                                                 | **Not performed**: NVDA is not installed and Narrator's speech cannot be observed in this session. Manual checklist recorded                                                 |

_CI run_: GitHub Actions [run 39405163945](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39405163945) on commit `4e0c00a` (ubuntu-latest). Every job passed with no retries.

| Job                                 | Result                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Static checks, unit tests and build | **Passed**: Vitest 164/164 with the coverage thresholds enforced; coverage report uploaded as an artifact                         |
| Browser tests (production preview)  | **Passed**: 89 passed, 4 skipped (Chromium, Firefox, WebKit)                                                                      |
| Docker image build and smoke test   | **Passed**: container checks plus the same browser suite against the running container in all three engines: 89 passed, 4 skipped |

**Acceptance criteria**

| Criterion                                                    | Result                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Zero axe violations across all states                        | **Met** for the 8 tested states at 3 widths                                                         |
| Manual keyboard and screen-reader checklist recorded in docs | **Met** for keyboard (performed); the screen-reader checklist is recorded but **not yet performed** |
| Reflow at 320 px and 400% zoom with no loss of content       | **Met** (400% emulated)                                                                             |
| Tests cover behaviour rather than implementation details     | **Met**: each Phase 3 regression test fails against its defect                                      |

### Phase 4 — Production verification, Docker execution, README completion, submission readiness

**Scope:** final production build review (bundle size, no source maps or dev code, headers). Clean-machine Docker build and run, with the browser suite run against the container. CI green on GitHub. A complete README (model, assumptions, accessibility notes, trade-offs, limitations, screenshots). Repository hygiene review (no secrets or private correspondence). Create the public GitHub repository only with the owner's confirmation, and leave the licence to the owner.

**Acceptance criteria:** `docker build` and `docker run` work from a fresh clone using the README commands; CI passes all jobs; the README is accurate to the shipped behaviour; the repository is public and the URL is recorded.

**Validation:** fresh-clone rehearsal, CI run link, container e2e run, final checklist.
**Depends on:** Phase 3, plus the owner's GitHub decisions (remote name, visibility, licence).

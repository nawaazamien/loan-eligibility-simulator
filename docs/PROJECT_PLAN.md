# Project plan — loan-eligibility-simulator

A responsive UI where a customer enters their details and a desired loan and sees an **estimated**, clearly fictional eligibility result. Phases 0–5 built it as a client-only simulator from the short brief; **Phase 6** aligned it with the employer's API specification, so it now calls four endpoints (answered by an in-browser mock) through a typed client. Built as a front-end engineering assessment.

Work proceeds one phase at a time: implement, validate, commit, report, stop.

## Requirement sources

The employer's email brief asks for five things (the first five rows); its attachment, the API specification, adds a sixth. Everything else, including the stack, the tools, CI and the stricter quality rules, was chosen for this project: by the approved design, by the project's own rules in [AGENTS.md](../AGENTS.md), or as an implementation decision.

| Requirement                                                                                                                                                                                                                                                    | Source                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Responsive UI for income, expenses and loan amount, showing estimated eligibility from mocked assumptions                                                                                                                                                      | **Employer**                                         |
| Production-grade implementation                                                                                                                                                                                                                                | **Employer**                                         |
| Runnable Dockerfile that builds and runs the app                                                                                                                                                                                                               | **Employer**                                         |
| README covering build, run and test                                                                                                                                                                                                                            | **Employer**                                         |
| Public GitHub repository for submission                                                                                                                                                                                                                        | **Employer**                                         |
| The API specification attachment (`docs/requirements/LoanEligibilitySimulatorEndpoints.md`): `POST /api/loans/eligibility`, `GET /api/loans/products`, `POST /api/loans/calculate-rate`, `GET /api/loans/validation-rules`, with exact field names and nesting | **Employer** (email attachment, found after Phase 5) |
| Product "Tally" + Demo tag, layout, tokens, typography, copy, states, interactions, debt and term inputs (the design's 19.5% / R69 / 40% model was **superseded in Phase 6** by the mock API's rules, D-054)                                                   | **Design** ([DESIGN_HANDOFF.md](DESIGN_HANDOFF.md))  |
| Estimate language only; no implied approval, offer or bureau check; no personal data collected or persisted; WCAG 2.2 AA target; strict TypeScript; pure model separate from components; tests before each commit                                              | **Project rules** ([AGENTS.md](../AGENTS.md))        |
| React, Vite, TypeScript, CSS Modules, Vitest + Testing Library, Playwright, axe, ESLint/Prettier, GitHub Actions CI, stack versions, folder structure, integer-cent arithmetic, nginx runtime, caching, CSP, test strategy                                     | **Implementation** ([DECISIONS.md](DECISIONS.md))    |

**Correction to the history (Phase 6).** The employer's email brief asked for a responsive simulator with mocked assumptions, production-grade quality, a Dockerfile, a README and a public repository. Phases 0–5 **met that brief**. The email also had an attachment, an API specification, which was overlooked until after Phase 5; the earlier "ready for submission" statements were true only against the email text. Phase 6 aligns the app with the attachment, and the earlier phases' records below are kept as written, with their model (19.5% / R69 / 40%) now superseded (D-054 to D-066).

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

**Status:** complete. **Ready for submission with documented manual verification gaps** (screen reader, real browser zoom, real Windows high contrast, Safari or a physical phone). The full record is [validation/phase-4/SUBMISSION_REVIEW.md](validation/phase-4/SUBMISSION_REVIEW.md).

**Validation record (2026-10-20)**, in `D:\Projects\loan-eligibility-simulator-phase1`, started from `51c164a`:

| Check                                     | Result                                                                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer walkthrough, 1280 and 360 px     | Every flow completed, with no console errors and no failed or off-origin requests. Found the dropped-click defect (D-041), now fixed                                                                             |
| Fresh clone following the README          | Every documented command passes after four README corrections (browsers, preview URL, Node range, PowerShell syntax)                                                                                             |
| Production review                         | No source maps, development code, storage or external requests. Licence notices added (D-046) and base-image pages excluded (D-044). JS 249.8 KB (77.8 KB gzip), CSS 17.9 KB (4.3 KB gzip), fonts loaded 89.3 KB |
| `npm audit`                               | 0 vulnerabilities                                                                                                                                                                                                |
| `npm run check` / `npm run test:coverage` | Passed: 164/164; model and reducer 100%                                                                                                                                                                          |
| `npm run test:e2e`                        | 99 passed, 4 skipped                                                                                                                                                                                             |
| Docker                                    | Local engine unavailable; verified in CI with the README's commands                                                                                                                                              |

_CI run_: GitHub Actions [run 39426416360](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39426416360) on commit `dd59a01` (ubuntu-latest). Every job passed with no retries.

| Job                                                    | Result                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static checks, unit tests and build, Node 22 (22.23.3) | **Passed**: Vitest 164/164, coverage thresholds met                                                                                                                                                                                                                                                                     |
| Static checks, unit tests and build, Node 24 (24.21.0) | **Passed**: Vitest 164/164, coverage thresholds met, report uploaded                                                                                                                                                                                                                                                    |
| Browser tests (production preview)                     | **Passed**: 99 passed, 4 skipped (Chromium, Firefox, WebKit)                                                                                                                                                                                                                                                            |
| Docker image build and smoke test                      | **Passed**: built and run with the README's commands. The image holds exactly 13 files in `/usr/share/nginx/tally` (index.html, favicon, notices, JS, CSS and 8 font files), with no source maps and no `50x.html`. uid 101, headers, caching and 404s as documented, and 99 browser tests passed against the container |

The JS and CSS file hashes in the CI image match the local build, so the build is reproducible across machines.

**Acceptance criteria**

| Criterion                                                                         | Result                                                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docker build` and `docker run` work from a fresh clone using the README commands | **Met in CI** (clean checkout, exact commands); not run locally       |
| CI passes all jobs                                                                | See the CI run below                                                  |
| The README is accurate to the shipped behaviour                                   | **Met**: verified from a fresh clone, and four inaccuracies corrected |
| The repository is public and the URL is recorded                                  | **Met**: https://github.com/nawaazamien/loan-eligibility-simulator    |

### Phase 5 — Expense helper and live demo

**Scope:** an optional, inline monthly-expense breakdown that can set the expenses field (D-048 to D-051), and a free public demo on Render (D-052).

**Validation record (2026-10-20)**, in `D:\Projects\loan-eligibility-simulator-phase1`, started from `245a4f1`:

| Check                    | Result                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`          | **Passed**: Vitest 208/208 in 11 files (44 new: category parsing and totals, helper state, reducer integration, component behaviour)                                                                                                                                                                                                                             |
| `npm run test:coverage`  | **Passed**: `model/**`, `formState.ts` and the new `expenseHelperState.ts` at 100% (enforced)                                                                                                                                                                                                                                                                    |
| `npm run test:e2e`       | **Passed**: 117 passed, 4 skipped. New: expanded, invalid, applied, cancelled and stale-after-apply states with axe at 1280, 360 and 320 px; text spacing; Enter-to-apply in Firefox and WebKit; the helper at a 32px default font                                                                                                                               |
| Enter handling           | Removing the Enter handler makes the unit test and both smoke tests fail                                                                                                                                                                                                                                                                                         |
| `render.yaml`            | Valid against Render's published JSON schema (a deliberately broken copy is rejected)                                                                                                                                                                                                                                                                            |
| First CI run (`c34f042`) | **Failed in the Docker job, a test defect**: the new text-spacing test injected a `<style>` that the container's CSP correctly blocked; the preview sent no CSP, so it had passed locally. Fixed with D-053: the preview now sends the production headers, the test models user stylesheets with `bypassCSP`, and a check keeps `render.yaml` identical to nginx |
| CI (`b1dcf5e`)           | **Passed**: [run 39462344573](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39462344573). Node 22 and 24: 208/208 each; 121 browser tests against the preview and 121 against the container, no retries                                                                                                                                 |
| Live demo                | **Live and verified** at https://tally-loan-simulator.onrender.com (see below)                                                                                                                                                                                                                                                                                   |

**Live demo verification (2026-10-20)**, against https://tally-loan-simulator.onrender.com:

| Check                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public access                                         | Loads over HTTPS without any login or deployment protection                                                                                                                                                                                                                                                                                                                                                                                 |
| Deployed version                                      | The served `index-DaDq6Az2.js` and `index-DaDyLjgl.css` are byte-for-byte the content hashes of a production build of `main`, so the live site runs the current application, expense helper included. Render's API was not available to name the exact commit Render built; every commit since `c34f042` produces this same bundle                                                                                                          |
| Headers on every file served                          | CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `Permissions-Policy` identical to nginx; Render adds HSTS                                                                                                                                                                                                                                                                               |
| Caching                                               | `no-cache` for `/`, `/index.html`, `/favicon.svg` and `/third-party-notices.txt`; `public, max-age=31536000, immutable` for the hashed JS, CSS and fonts, all with correct content types                                                                                                                                                                                                                                                    |
| Unknown paths                                         | 404 (`/does-not-exist`, `/assets/nope.js`, `/50x.html`). **Difference from the container:** Render's own 404 is a plain-text "Not Found" without the security headers, which `render.yaml` header rules do not reach. The risk is low (fixed text, no markup), and it is recorded rather than called parity                                                                                                                                 |
| Browser suite with `E2E_BASE_URL` set to the live URL | **122 passed, 8 skipped, 0 failed**: Chromium at 1280, 360 and 320 px (including axe and the helper flows), the Firefox and WebKit smoke suites, and Firefox at a 32px default font. Every flow ran under the live CSP, except the text-spacing test, which models a user stylesheet. An earlier attempt was invalidated by another Playwright run in the same checkout sharing `test-results/`; the counted run used its own output folder |
| Data handling                                         | A scripted session with distinctive values made 7 same-origin GET requests, none with a body or containing the values. localStorage, sessionStorage, IndexedDB and cookies stayed empty, with no console errors                                                                                                                                                                                                                             |

Manual accessibility gaps remain as listed in the submission review: no real screen-reader pass (including the new helper), no real browser zoom, no real Windows high contrast, and no Safari or physical phone.

Accessibility of the helper is covered by axe, keyboard and focus tests, text spacing and larger text. It has **not** had a real screen-reader pass; that stays on the manual checklist.

### Phase 6 — Align with the employer's API specification

**Status:** complete, verified locally, in CI and on the live demo. See the [Phase 6 review](validation/phase-6/SUBMISSION_REVIEW.md) for the full record, the requirement checklist and the manual gaps.

**Scope:** the specification attachment overlooked until after Phase 5: a typed API client and an in-browser mock (Mock Service Worker) for the four endpoints; a form built from the validation rules and products; eligibility, likelihood, risk, recommended amounts, ratios and the complete repayment schedule from the API; asynchronous states; traceability, an API document and independent verification of the financial values (D-054 to D-066).

**Validation record (2026-10-20)**, commit `08b6216`:

| Check                        | Result                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`              | **Passed**: 284 unit and component tests in 15 files; production build                                                                                                                                                                                        |
| `npm run test:coverage`      | **Passed**: 100% enforced for `model/**`, `formState.ts` and `expenseHelperState.ts`                                                                                                                                                                          |
| `npm run test:e2e` (preview) | **Passed**: 158 passed, 20 skipped by design (engine- or width-specific)                                                                                                                                                                                      |
| Fresh clone of `main`        | **Passed**: `npm ci`, `npm run check`, and the estimate and privacy browser specs                                                                                                                                                                             |
| CI                           | **Passed**: [run 39503390798](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39503390798), all four jobs (Node 22 and 24, browser tests, Docker build with the browser suite against the container)                                   |
| Live demo                    | **Passed**: the full browser suite against https://tally-loan-simulator.onrender.com, 158 passed, 20 skipped; the served script hash equals a local build of `main`; `/mockServiceWorker.js` is served as JavaScript with `no-cache` and the security headers |

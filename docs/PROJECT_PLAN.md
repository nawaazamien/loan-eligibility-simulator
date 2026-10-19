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

### Phase 2 — Deterministic simulation, validation, result states, stale results, reset

**Scope:** the pure model in `src/features/loan-simulator/model/` (constants, parseAmount, validate, calculate, format, copy) exactly as specified in [SIMULATION_MODEL.md](SIMULATION_MODEL.md). A reducer for form state. Submit validation with an ErrorSummary and inline errors, then re-validation on blur. Result states (within, above, none) with the outcome block, figure, explanation, summary `dl`, income breakdown and next steps. Stale detection by normalised key, recalculation, the mobile stale note, the live announcement, focus and scroll to results, and full Reset.

**Acceptance criteria**

- All 8 reference cases and the boundary list in SIMULATION_MODEL §6–7 pass as unit tests.
- Every message and template string matches the handoff verbatim.
- Board states 1b–1g and 1k–1m reproduce at both widths.
- The model module has no React imports. It has full branch coverage, and components contain no maths.

**Validation:** Vitest model suite with coverage report, RTL integration tests for each state, Playwright journeys (calculate, edit to stale, recalculate, invalid submit, reset).
**Depends on:** Phase 1.

### Phase 3 — Accessibility, responsive refinement, meaningful automated coverage

**Scope:** WCAG 2.2 AA pass. Automated axe checks (via `@axe-core/playwright` or `vitest-axe`) on every state. Keyboard-only journeys, focus order and focus-not-obscured with the sticky desktop panel. 200% and 400% zoom and text-spacing checks. Reduced motion. Contrast check of every token pair in use. Screen-reader announcements (live region, `role=alert`, `role=status`). Fixes for anything found.

**Acceptance criteria:** zero axe violations across all states; manual keyboard and screen-reader checklist recorded in docs; reflow at 320 px and 400% zoom with no loss of content; tests cover behaviour rather than implementation details.

**Validation:** axe suites, Playwright keyboard tests, a documented manual pass (NVDA or Narrator on Windows, plus a mobile emulation check).
**Depends on:** Phase 2.

### Phase 4 — Production verification, Docker execution, README completion, submission readiness

**Scope:** final production build review (bundle size, no source maps or dev code, headers). Clean-machine Docker build and run, with the browser suite run against the container. CI green on GitHub. A complete README (model, assumptions, accessibility notes, trade-offs, limitations, screenshots). Repository hygiene review (no secrets or private correspondence). Create the public GitHub repository only with the owner's confirmation, and leave the licence to the owner.

**Acceptance criteria:** `docker build` and `docker run` work from a fresh clone using the README commands; CI passes all jobs; the README is accurate to the shipped behaviour; the repository is public and the URL is recorded.

**Validation:** fresh-clone rehearsal, CI run link, container e2e run, final checklist.
**Depends on:** Phase 3, plus the owner's GitHub decisions (remote name, visibility, licence).

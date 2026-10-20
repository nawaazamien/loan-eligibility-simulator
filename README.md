# Loan eligibility simulator (Tally — demo)

A responsive web app built against the employer's loan API specification ([stored here](docs/requirements/LoanEligibilitySimulatorEndpoints.md)). A customer enters their age, employment, income, expenses, existing debt repayments, an optional credit score, a loan purpose, amount and term, and sees an **illustrative** eligibility estimate: likelihood, risk, recommended amount, interest rate, monthly payment, affordability analysis and the complete repayment schedule.

The four endpoints (`GET /api/loans/validation-rules`, `GET /api/loans/products`, `POST /api/loans/eligibility`, `POST /api/loans/calculate-rate`) are answered by a **mock API running inside the browser** (a service worker), so the demo needs no server; the UI calls them through a typed client and can be pointed at a real API with one build setting ([docs/API.md](docs/API.md)).

**Live demo: [tally-loan-simulator.onrender.com](https://tally-loan-simulator.onrender.com)** (free Render static hosting).

Built for a Front-End Software Engineer recruitment assignment. "Tally" is a fictional product name; the app is not affiliated with any bank or lender.

> **Fictional data.** Every decision rule and price here (the interest rate by credit score, the 40% affordability limit, the likelihood and risk) is a made-up, deterministic assumption of the mock, not the employer's rules and not any lender's policy. This is not a credit check, an approval or an offer. The values you type are answered inside your browser by the mock; nothing is stored and nothing is sent to any other server.

![Desktop: the details form on the left with the example applicant, and on the right the estimate: the outcome, an estimated monthly payment, an illustrative approval likelihood and risk category, summary figures, and the affordability details and repayment schedule sections.](docs/images/tally-desktop.png)

<img src="docs/images/tally-mobile.png" width="300" alt="Mobile: the estimate panel on a phone, showing the outcome, the estimated monthly payment, the illustrative likelihood and risk, and the summary figures." />

## Quick start

Requires **Node.js 24** (tested with 24.18.0; the `.nvmrc` default) or **22.22.2 or later on the 22 line** (checked in CI), and npm 10 or later.

```sh
npm ci              # install exactly what package-lock.json specifies
npm run dev         # development server: http://localhost:5173
```

To run the production build locally:

```sh
npm run build       # type-checks, then writes the static site to dist/
npm run preview     # serves dist/ at http://localhost:4173
```

## Docker

```sh
docker build -t loan-eligibility-simulator .
docker run --rm -p 8080:8080 loan-eligibility-simulator
# open http://localhost:8080
```

The image builds the app with Node, then serves only the static files from unprivileged nginx (non-root, uid 101, port **8080**). `index.html` is sent with `Cache-Control: no-cache`, so a new deploy shows up immediately, and content-hashed files under `/assets/` are cached for a year as `immutable`. Every response carries a strict Content Security Policy (`'self'` only) and standard security headers. Unknown paths return 404, because the app has no client-side routes.

## Tests

```sh
npm run check           # typecheck + lint + format check + unit tests + build: the main gate
npm test                # unit and component tests (Vitest), run once
npm run test:watch      # the same, re-running on change
npm run test:coverage   # unit tests with a coverage report in coverage/
npm run test:e2e        # browser tests (Playwright) against the production build
npm run test:a11y       # only the axe accessibility checks
```

The browser tests need Playwright's browsers once:

```sh
npx playwright install chromium firefox webkit                # Windows and macOS
npx playwright install --with-deps chromium firefox webkit    # Linux: also installs system libraries
```

`npm run test:e2e` builds the app and serves it itself. To run the same suite against something already running, such as the Docker container:

```sh
E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e           # bash, zsh
```

```powershell
$env:E2E_BASE_URL = "http://127.0.0.1:8080"; npm run test:e2e; Remove-Item Env:E2E_BASE_URL   # PowerShell
```

What runs: unit and component tests (Vitest, with the real API client talking to the mock over intercepted HTTP) and browser tests (Playwright). `test:coverage` enforces 100% coverage for the form model, the form reducer and the expense helper's state. Chromium runs everything: layout, interactions, results, the privacy and service-worker checks and axe checks at 1280, 360 and 320 px. Firefox and WebKit run the core flows. CI runs all of this on every push, then runs the browser suite a second time against the built Docker image.

## How it works

```
src/
  api/                           the contract (types), runtime guards and the typed client
  mock-api/                      the mock API: MSW handlers, pricing and eligibility rules, browser setup
  app/App.tsx                    page: header, intro, simulator, footer; the API client seam
  components/                    shared presentational pieces (SiteHeader, SiteFooter, Button, FrameCorners)
  features/loan-simulator/
    LoanSimulator.tsx            loads rules and products, then the form and estimate; moves focus
    formState.ts                 pure reducer: edits, submit, pending requests, results and their freshness
    useCalculation.ts, useLoanData.ts   the effects that call the client (and cancel superseded requests)
    LoanForm.tsx, ResultsPanel.tsx, ResultDetails.tsx, ScheduleTable.tsx and their parts
    model/                       pure functions, no React: parsing, validation, request building, formatting
  styles/                        design tokens and global CSS
public/mockServiceWorker.js      the generated MSW worker (do not edit)
e2e/                             Playwright browser tests
nginx/, Dockerfile, render.yaml  runtime server, headers and caching
```

- **The API is the seam.** The UI depends only on the `ApiClient` interface. Every limit and message in the form comes from `GET /api/loans/validation-rules`; every figure on screen comes from the API's responses. Swapping the mock for a real API changes nothing in `features/` ([docs/API.md](docs/API.md)).
- **Pure model, thin UI.** Parsing, validation, request building and formatting are plain TypeScript in `model/`, unit-tested without React. Components contain no lending maths.
- **Editing versus calculating.** Fields keep exactly what was typed and are tidied only when you leave them (`28500` → `28 500`). Empty and malformed text is never turned into zero. Calculate validates everything at once, with a linked error summary and inline errors.
- **One snapshot per result.** Every figure on screen comes from the responses to one submission. Change an input and the estimate stays visible but is marked out of date; change it back and it is current again. Formatting alone never counts as a change.
- **Honest asynchronous states.** Loading the rules, a calculation in flight, a failed load or calculation (with retry), a failed schedule alone (the eligibility result stays, with its own retry), validation errors from the API, and answers that arrive after a reset or after the inputs changed (ignored) are all handled and tested. A repeated press with the same inputs sends no second request.
- **Optional expense helper.** "Help me calculate my expenses", under the expenses field, breaks living costs into 8 categories (blank counts as R0) and shows a running total. It is only a draft: the expenses field changes only when you select **Use this total**, and the calculation always reads that one field. An unchanged total leaves an estimate current; a different total marks it out of date. Opening the helper keeps whatever is already in the field, and Cancel discards the draft.

### The fictional model

The specification defines the API's shapes, not its decisions, so the mock's rules are narrow, deterministic assumptions (all in [SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md), numbered A1–A19 in [TRACEABILITY.md](docs/requirements/TRACEABILITY.md)):

- **Rate:** within the product's published range (personal loan 10.5%–18.5%), set by credit score; no score gives the middle of the range. A score of 650 gives the specification's example 12.5%.
- **Affordability:** a new payment may use up to 40% of income minus expenses minus existing monthly debt repayments (an exact integer test). The maximum amount is the largest R1 000 step that fits.
- **Likelihood, risk, affordability score:** simple documented scoring; an unemployed applicant is not assessed.
- **Schedule:** integer cents, level payment rounded half-up once, each month's interest rounded half-up, and the final payment adjusted so the balance ends at exactly R0.00.

The figures were recomputed independently in high-precision decimals ([verify_reference.py](docs/validation/phase-6/verify_reference.py)) and are asserted in the tests. The specification's own example numbers do not agree with each other (for example, R150 000 over 24 months at 12.5% is R7 096.10 a month, not R7 089.50); see [TRACEABILITY.md](docs/requirements/TRACEABILITY.md#6-where-the-specification-disagrees-with-itself).

### Key decisions and trade-offs

- **A mock API in the browser, not a backend.** The brief asks for a mocked API; a Mock Service Worker answers the four endpoints as real HTTP in the browser, so the app stays a static site, the client code is the code a real API would use, and no personal financial data leaves the browser. The trade-off is that it needs a browser with service workers.
- **React 19, Vite, strict TypeScript, CSS Modules with design tokens**, and no component library: native, labelled form controls are enough and are easier to make accessible.
- **Accessibility fixes over pixel fidelity** where the design fell short: darker filled buttons (contrast), visible field borders, rem-based text that follows the browser's text size, and system colours in Windows high-contrast mode.
- **Proportionate browser coverage:** the full suite in Chromium at three widths, core flows in Firefox and WebKit, rather than every test in every engine.

Every decision, with its reason and source, is in [DECISIONS.md](docs/DECISIONS.md).

## Accessibility

Targeting WCAG 2.2 AA. Automated axe checks pass for every tested state at three widths. Keyboard order and focus, contrast (measured), emulated 200% and 400% zoom, text spacing, larger browser text, forced colours, reduced motion and target sizes were reviewed and fixed where needed. See the [accessibility review](docs/validation/phase-3/ACCESSIBILITY_REVIEW.md).

**Still to be checked by a person:** a screen reader (NVDA or Narrator), the browser's own zoom at 200% and 400%, a real Windows high-contrast theme, and Safari or a physical phone. This is not a WCAG conformance claim.

## Hosting

The live demo at https://tally-loan-simulator.onrender.com is a free [Render](https://render.com) Static Site defined in `render.yaml`:

- **Build:** `npm ci && npm run build` on Node 24, publishing `dist/`.
- **Deploys:** only after CI passes on `main`.
- **Headers:** the same security headers and caching as the nginx container, including `no-cache` for `/mockServiceWorker.js` so a new worker is picked up. There are no rewrite rules, so unknown paths return 404 there too.

Differences from Docker: Render's CDN serves the files and adds HTTPS (with HSTS) and Brotli, and the nginx configuration is not used; `render.yaml` reproduces its headers instead. One difference remains: Render's built-in 404 page is a plain-text "Not Found" without the security headers, which the nginx container sends on every response.

## Known limitations

- The decision rules are deliberately simple and fictional: no credit history, credit insurance, rate changes or bureau data.
- The demo needs service workers (HTTPS or localhost). Where they are blocked the page says so instead of failing silently.
- Vehicle finance is listed and priced by the API but not assessed for eligibility: the eligibility request has no product field, so the check is for the personal loan (TRACEABILITY A6).
- Light theme only, as designed.
- WebKit coverage is Playwright's WebKit build, not Safari on a real iPhone or Mac.
- No licence has been chosen yet; that is the repository owner's decision. Third-party licences for the bundled code and fonts are in [`public/third-party-notices.txt`](public/third-party-notices.txt), which is also served with the app.

## How this was built

The visual design was produced in Claude Design (Anthropic) and is kept for reference in [`design/reference/`](design/reference/). The code, tests and documentation were written with Claude Code (Anthropic) under the author's direction and review; commits that include AI-written changes carry a `Co-Authored-By` trailer. Building and testing the project needs none of these tools or any account: everything required is in this repository.

## Documentation

- [Submission review](docs/validation/phase-4/SUBMISSION_REVIEW.md): final verification, production review and requirement checklist
- [Interview notes](docs/INTERVIEW_NOTES.md): the main engineering choices, briefly explained
- [API and mock](docs/API.md): the contract, the error format, the in-browser mock, the service worker and how to use a real API
- [Requirements traceability](docs/requirements/TRACEABILITY.md): every endpoint, field and rule mapped to the code, with the assumptions
- [Simulation model](docs/SIMULATION_MODEL.md): the mock's pricing and decision rules, rounding and independently verified reference cases
- [Accessibility review](docs/validation/phase-3/ACCESSIBILITY_REVIEW.md): methods, findings, fixes and the manual checklist
- [Decisions](docs/DECISIONS.md): technical and product decisions, with reasons
- [Design handoff](docs/DESIGN_HANDOFF.md): what the imported design specifies, and where the build deviates
- [Project plan](docs/PROJECT_PLAN.md): the phases, their acceptance criteria and validation records

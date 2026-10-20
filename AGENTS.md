# AGENTS.md — loan-eligibility-simulator

Rules for anyone (human or agent) changing this repository.

## Workflow

- Work one phase at a time, as defined in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md). Finish, validate, commit and report a phase, then stop. Do not start the next phase unprompted.
- Report validation honestly: name the exact commands run and their results. Separate real failures from unavailable tooling and from pre-existing issues. Never claim a check passed if it was not run.
- Record any decision that changes the design, the model or the stack in [docs/DECISIONS.md](docs/DECISIONS.md).

## Design

- The visual reference is the imported Claude Design project in [design/reference/](design/reference/), summarised in [docs/DESIGN_HANDOFF.md](docs/DESIGN_HANDOFF.md). Follow it for layout, copy, tokens and states. Do not invent alternative designs.
- Ship the customer-facing app only. Never ship the presentation board, design annotations, preview presets or the design runtime (`support.js`).
- Take colours, fonts and spacing from `src/styles/tokens.css`. Do not hard-code new hex values in components.

## Code

- TypeScript in strict mode (see `tsconfig.app.json`). No `any`, no non-null assertions to silence the compiler.
- Keep calculations, parsing, validation and formatting as pure functions, separate from React components. Components contain no lending maths.
- Use semantic HTML and native, accessible controls: visible labels, `fieldset`/`legend` for groups, real buttons, correct landmarks and heading order, visible focus. Target WCAG 2.2 AA.
- The only service worker is the generated Mock Service Worker script that answers the four mocked API endpoints in the browser (`public/mockServiceWorker.js`, scope `/`, never edited by hand). It is infrastructure, documented in [docs/API.md](docs/API.md); the UI reaches the API only through the typed client in `src/api/`.
- No unnecessary frameworks, services or abstractions. No component library for basic fields and cards. No backend, database, authentication, analytics or external AI calls.
- Do not create empty folders or speculative shared layers.

## Product and content

- All lending assumptions (rate, fee, affordability rule, limits) are fictional and must be labelled as fictional wherever they appear.
- Never imply a real approval, offer, credit decision or credit-bureau check. Use estimate wording ("estimate", "illustrative", "demo limit").
- No real bank branding. The product name is the fictional "Tally" with a visible "Demo" tag.
- Collect no personal data beyond the numeric inputs, and persist nothing by default (no storage, cookies or network calls with user input).

## Repository hygiene

- Never commit secrets, tokens, design-tool credentials, private correspondence or personal contact details. The repository will be public.
- `design/reference/support.js` is a generated design-preview runtime. It stays local (git-ignored) and is never bundled.
- Commit `package-lock.json`. Install with `npm ci`.
- Before committing, run `npm run check` and, for UI changes, `npm run test:e2e`.

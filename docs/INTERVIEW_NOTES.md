# Interview notes

Short explanations of the main choices in this project, with pointers to the code and records. Decision numbers refer to [DECISIONS.md](DECISIONS.md).

## Why a mock API in the browser

The first five phases built a simulator from the short email brief: mocked assumptions, calculated in the browser. The employer's attachment, a four-endpoint API specification, was overlooked, and Phase 6 corrects that rather than hiding it (D-054; the history in [PROJECT_PLAN.md](PROJECT_PLAN.md) says which phases met which document).

The brief wants a mocked API and a static or Docker deployment. A Mock Service Worker answers the four endpoints as real HTTP inside the browser, so the app stays a static site while the UI talks to one typed client (`src/api/client.ts`). Replacing the mock with a real API is a build setting (`VITE_API_BASE_URL`) plus a CSP entry; nothing in `features/` changes ([API.md](API.md), D-055, D-060). Because the worker is infrastructure that handles user input, its scope, storage, caching and privacy are documented and tested (D-059). Alternatives I rejected: a hand-written fake `fetch` (not real HTTP, so contract tests prove less) and a Node mock server (cannot be a static site).

What it costs: it needs a browser with service workers, so the page shows a clear error where they are blocked, and the worker script has to be served revalidated.

## Editing text versus canonical values

A field keeps exactly what was typed, even `28 5o0` or an empty string. Nothing is reformatted while typing, so the caret never jumps. On blur, a valid amount is tidied (`28500` → `28 500`) and anything else is left alone. Parsing (`model/amount.ts`) turns text into one of `empty`, `malformed`, `negative` or `ok(cents)`, so an empty field is never mistaken for zero. Cents come from the digit strings, never `parseFloat`. Validation (`model/validate.ts`) checks the design's order (empty → malformed → negative → range), and never clamps or rounds what was typed (D-021).

## The expense helper: a draft, not a second source

"Help me calculate my expenses" breaks expenses into eight categories, but the calculation still reads only the one expenses field. Category edits are a draft. "Use this total" sums the categories in integer cents and writes the field through the same reducer path as typing, so freshness, validation and the model are untouched. An unchanged total leaves an estimate current; a changed one marks it out of date. Opening the helper never throws away a typed total (it starts under "Other living expenses"), and a remembered breakdown is dropped as soon as the field holds a different amount (`expenseHelperState.ts`, D-048 to D-051).

## Integer cents and the rounding rules

Money is integer cents in the mock and in the form's formatting; rates are integer basis points. The level payment is rounded half-up once; each month's interest is rounded half-up from the opening balance; and the **final payment is adjusted** so the balance ends at exactly 0.00 instead of leaving or overpaying a few cents. The one floating-point step is the annuity factor. The figures were recomputed independently in Python's `decimal` (`docs/validation/phase-6/verify_reference.py`) and are asserted in the tests, so the TypeScript and the check cannot share a bug ([SIMULATION_MODEL.md](SIMULATION_MODEL.md), D-056).

## The exact affordability comparison, and the spec that disagrees with itself

In the mock, "a new payment may use up to 40% of what's left" is tested as `5 × payment ≤ 2 × available`: integers on both sides, with no 0.4 multiplication, so no boundary depends on floating-point error.

The independent check also found that the specification's own example is inconsistent: R150 000 over 24 months at 12.5% is R7 096.10 a month, not R7 089.50 (its first row's interest, 1 562.33, is not 150 000 × 12.5% ÷ 12 = 1 562.50), its loan-to-income 60.0 matches no stated formula, and its sample inputs cannot afford its sample loan. I did not copy numbers that disagree; the tests assert the arithmetic and [TRACEABILITY.md](requirements/TRACEABILITY.md#6-where-the-specification-disagrees-with-itself) records each discrepancy (D-062).

## Snapshots and derived freshness

A calculation is the pair of API responses to one submission, stored as a snapshot together with a canonical key of its inputs (every field, amounts in cents, the credit score "not given" distinct from any score). "Out of date" is never stored; on every render the current inputs are keyed the same way and compared. Consequences:

- every figure on screen comes from one stored snapshot, never from the live form;
- formatting-only edits (`28500` ↔ `R28,500.00`) keep it current;
- changing a value back makes it current again;
- an invalid edit can never match, so it always marks the result out of date;
- a failed resubmission leaves the old estimate visible and still marked out of date.

Asynchronous state adds a second source of wrong figures, so the reducer records the pending request with an id and treats every outcome as an action that is ignored unless its id still matches: duplicate presses, a request superseded by an edit, an answer after Reset, and a late schedule answer are all dropped (and requests are cancelled). If only the schedule fails, the eligibility result stays with its own retry; a schedule that disagrees with the estimate is refused (D-058). See `formState.ts`, D-026 and D-027.

## Accessibility: what the review found

Automated checks (axe, whole page, no rules disabled) found one problem: light text on the accent fill was 3.71:1. Measuring every colour pair by hand found another that axe doesn't check: text-field borders at 1.38:1. Both were fixed with darker shades from the design's own palette (D-033). Other findings came from deliberate probes, not tools:

- In Windows high-contrast mode the selected term was invisible (D-034).
- All text was in `px` and ignored the browser's text-size setting (D-035).
- Firefox left a focused button partly off-screen (D-036).
- In the final review: on a phone, pressing Calculate right after editing a field could do nothing. Leaving the field added an inline error, which moved the button between mouse-down and mouse-up (D-041).

Each fix has a regression test that was shown to fail without it. Real screen-reader testing and real browser zoom have **not** been done yet; the review says so and includes a checklist ([ACCESSIBILITY_REVIEW.md](validation/phase-3/ACCESSIBILITY_REVIEW.md)).

## Testing boundaries

- **Contract** (`src/api/client.test.ts`): the real client against the mocked endpoints over intercepted HTTP, with shapes compared to the specification's own JSON.
- **Model and reducer** (`model/`, `formState.ts`): pure functions and the reducer, 100% statement and branch coverage, enforced. The async lifecycle (pending, duplicate, supersede, stale, reset, schedule retry) is reducer tests.
- **Components** (Vitest + Testing Library + MSW): behaviour through roles and labels, including loading, failure and retry, request counts for duplicate submits, and axe over the failure states.
- **Browser** (Playwright, production build): the real service worker, real layout, keyboard and focus, axe, privacy (what is stored and what is sent), reflow at three widths, and Firefox and WebKit core flows. CI repeats the browser suite against the Docker image.
- Coverage numbers are enforced only where they mean something; UI components are judged by behaviour tests instead (D-038).

## Docker and caching

The Dockerfile uses two stages: Node builds from the lockfile, then unprivileged nginx (uid 101, port 8080) serves only the built files from a directory of their own (D-006, D-044). `index.html` is `no-cache` (always revalidated), so a new deploy is picked up immediately. Content-hashed `/assets/*` are cached for a year as `immutable`. There is a strict CSP (`'self'` only), which self-hosted fonts make possible (D-011). Unknown paths are a real 404, because there are no client-side routes (D-007). CI checks all of this with the README's own commands (D-047).

## Limitations, and what a real lending system would need

This is a demonstration with a fictional mock. A real product would need, at least:

- the lender's actual pricing and affordability policy (and the National Credit Act affordability assessment in South Africa), owned and versioned server-side, with the decision run and audited on the server rather than trusted from the browser; the mock here is only a stand-in for that API;
- disclosure of the real cost of credit: initiation fees, insurance, rate changes;
- identity, consent, credit-bureau data and secure handling of personal information (POPIA);
- monitoring, analytics with consent, and real-device and assistive-technology testing with users.

None of that is implied by this app, which says so on screen.

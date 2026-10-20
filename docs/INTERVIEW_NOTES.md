# Interview notes

Short explanations of the main choices in this project, with pointers to the code and records. Decision numbers refer to [DECISIONS.md](DECISIONS.md).

## Why client-only

The brief asks for an estimate from mocked assumptions. The rate, fee and rule are constants, and the calculation is a few arithmetic steps. There is nothing that must be kept secret or shared between users, and a server would only add a place where someone's income and debts could be sent, logged or stored. Running everything in the browser means the app can promise, truthfully, that it stores and sends nothing. A browser test checks this: a full walkthrough makes only same-origin GET requests, and none carries a body. The production image is static files behind nginx (D-006, D-010).

## Editing text versus canonical values

A field keeps exactly what was typed, even `28 5o0` or an empty string. Nothing is reformatted while typing, so the caret never jumps. On blur, a valid amount is tidied (`28500` → `28 500`) and anything else is left alone. Parsing (`model/amount.ts`) turns text into one of `empty`, `malformed`, `negative` or `ok(cents)`, so an empty field is never mistaken for zero. Cents come from the digit strings, never `parseFloat`. Validation (`model/validate.ts`) checks the design's order (empty → malformed → negative → range), and never clamps or rounds what was typed (D-021).

## The expense helper: a draft, not a second source

"Help me calculate my expenses" breaks expenses into eight categories, but the calculation still reads only the one expenses field. Category edits are a draft. "Use this total" sums the categories in integer cents and writes the field through the same reducer path as typing, so freshness, validation and the model are untouched. An unchanged total leaves an estimate current; a changed one marks it out of date. Opening the helper never throws away a typed total (it starts under "Other living expenses"), and a remembered breakdown is dropped as soon as the field holds a different amount (`expenseHelperState.ts`, D-048 to D-051).

## Integer cents and the one rounding step

Every amount is an integer number of cents. The only floating-point operation is the amortisation factor, `r ÷ (1 − (1 + r)^−n)`. The instalment `principal × factor` is rounded once, half-up, to a whole cent, and the R69 fee is added in integers (`model/calculate.ts`). Totals, the money left and the limit all follow in integer arithmetic. The design said "round only for display"; this changes that deliberately, so that the repayment shown is exactly the figure that was compared (D-008). A zero-rate branch (`principal ÷ n`) is defined and tested, although the demo rate is never zero.

## The exact affordability comparison

"The repayment may use up to 40% of what's left" is tested as `5 × repayment ≤ 2 × available`: integers on both sides, with no 0.4 multiplication. Reference case 5 sits exactly on the boundary (`5 × 108 204 = 2 × 270 510`) and is "within". One cent less income (case 6) is "above". Both are unit tests. All eight reference cases were re-derived independently with 50-digit decimal arithmetic before the TypeScript was written, and all matched. The "borrow about R… or less" suggestion is found by searching with the same repayment function, so it can never contradict the rule (D-008, SIMULATION_MODEL §3).

## Snapshots and derived freshness

A successful calculation stores the estimate and a canonical key of its inputs: each amount in cents, plus the term. "Out of date" is never stored; on every render the current inputs are keyed the same way and compared. Consequences:

- every figure on screen comes from one stored estimate, never from the live form;
- formatting-only edits (`28500` ↔ `R28,500.00`) keep it current;
- changing a value back makes it current again;
- an invalid edit can never match, so it always marks the result out of date;
- a failed resubmission leaves the old estimate visible and still marked out of date.

See `formState.ts` and D-026. Focus and the screen-reader announcement are tied to a per-calculation counter, so an identical recalculation is announced exactly once (D-027).

## Accessibility: what the review found

Automated checks (axe, whole page, no rules disabled) found one problem: light text on the accent fill was 3.71:1. Measuring every colour pair by hand found another that axe doesn't check: text-field borders at 1.38:1. Both were fixed with darker shades from the design's own palette (D-033). Other findings came from deliberate probes, not tools:

- In Windows high-contrast mode the selected term was invisible (D-034).
- All text was in `px` and ignored the browser's text-size setting (D-035).
- Firefox left a focused button partly off-screen (D-036).
- In the final review: on a phone, pressing Calculate right after editing a field could do nothing. Leaving the field added an inline error, which moved the button between mouse-down and mouse-up (D-041).

Each fix has a regression test that was shown to fail without it. Real screen-reader testing and real browser zoom have **not** been done yet; the review says so and includes a checklist ([ACCESSIBILITY_REVIEW.md](validation/phase-3/ACCESSIBILITY_REVIEW.md)).

## Testing boundaries

- **Model** (`model/`, `formState.ts`): pure functions and the reducer, 100% statement and branch coverage, enforced. This is where every figure and outcome is decided.
- **Components** (Vitest + Testing Library): behaviour through roles and labels: validation, focus, freshness, announcements.
- **Browser** (Playwright, production build): real layout, keyboard and focus, axe, reflow at three widths, and Firefox and WebKit core flows. CI repeats the browser suite against the Docker image.
- Coverage numbers are enforced only where they mean something; UI components are judged by behaviour tests instead (D-038).

## Docker and caching

The Dockerfile uses two stages: Node builds from the lockfile, then unprivileged nginx (uid 101, port 8080) serves only the built files from a directory of their own (D-006, D-044). `index.html` is `no-cache` (always revalidated), so a new deploy is picked up immediately. Content-hashed `/assets/*` are cached for a year as `immutable`. There is a strict CSP (`'self'` only), which self-hosted fonts make possible (D-011). Unknown paths are a real 404, because there are no client-side routes (D-007). CI checks all of this with the README's own commands (D-047).

## Limitations, and what a real lending system would need

This is a demonstration with a fictional rule. A real product would need, at least:

- the lender's actual pricing and affordability policy (and the National Credit Act affordability assessment in South Africa), owned and versioned server-side, with the calculation run and audited on the server rather than trusted from the browser;
- disclosure of the real cost of credit: initiation fees, insurance, rate changes;
- identity, consent, credit-bureau data and secure handling of personal information (POPIA);
- monitoring, analytics with consent, and real-device and assistive-technology testing with users.

None of that is implied by this app, which says so on screen.

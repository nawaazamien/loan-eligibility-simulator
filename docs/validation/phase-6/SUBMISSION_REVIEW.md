# Phase 6 submission review

**Verdict: the app now implements the employer's API specification (as a mock) and the email brief, with documented assumptions and manual verification gaps.** It is not claimed to implement the employer's _decision rules_: the specification does not state any, so the mock's rules are fictional, deterministic assumptions (TRACEABILITY A8, A9).

## 1. What was tested

| Item  | Value                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| Code  | commit `08b6216` on `main`                                                                                             |
| Local | Windows 11, Node 24.18.0; Playwright Chromium, Firefox, WebKit                                                         |
| CI    | [run 39503390798](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39503390798): all jobs passed |
| Live  | https://tally-loan-simulator.onrender.com                                                                              |

## 2. Requirement checklist

| Requirement                                                                                                                                    | Status                       | Evidence                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Four endpoints, exact field names and nesting                                                                                                  | Met                          | [TRACEABILITY.md](../../requirements/TRACEABILITY.md); `client.test.ts` (42 contract tests over HTTP) |
| No `loanType` in the eligibility request                                                                                                       | Met                          | asserted in unit, component and browser tests                                                         |
| UI calls the API through the client                                                                                                            | Met                          | `LoanSimulator.test.tsx`; `e2e/privacy.spec.ts` (every request answered by the worker)                |
| Credit score optional; employment duration required, minimum 3, no silent exemption                                                            | Met                          | `validate.test.ts`, `eligibility.test.ts`, browser tests                                              |
| Form built from validation rules and products                                                                                                  | Met                          | `rules.test.ts`; `e2e/form.spec.ts`                                                                   |
| Eligibility, likelihood, risk, reason, maximum and recommended amounts, rate, payment, total, disposable income, DTI, LTI, affordability score | Met                          | `e2e/estimate.spec.ts`                                                                                |
| Complete accessible schedule table                                                                                                             | Met                          | 24 and 36 rows asserted; first and last rows equal the independent calculation                        |
| Simulated-estimate disclaimers                                                                                                                 | Met                          | on the estimate, with the assumptions disclosure                                                      |
| Loading, load failure with retry, pending, success, failure with retry, validation errors, out of date, reset, example                         | Met                          | `formState.test.ts`, `LoanSimulator.test.tsx`                                                         |
| Duplicate submits, stale and abandoned responses ignored; partial failure                                                                      | Met                          | same                                                                                                  |
| Financial values verified independently                                                                                                        | Met                          | `docs/validation/phase-6/verify_reference.py`                                                         |
| Static-site and Docker deployment; real API replacement documented                                                                             | Met                          | CI container job; [API.md](../../API.md)                                                              |
| Service worker documented, scoped, no storage, CSP unchanged, caching handled                                                                  | Met                          | API.md; `privacy.spec.ts`; `hosting-config.spec.ts`                                                   |
| Accessibility states                                                                                                                           | Met, with the limit in D-064 | `a11y.spec.ts` (browser), `accessibility.test.tsx` (failure states in jsdom)                          |

## 3. Assumptions and differences to know about

- The specification's examples disagree with each other (payment, loan-to-income, affordability of the sample inputs); they are not reproduced. See TRACEABILITY §6 and D-062.
- Vehicle finance is listed and priced but not assessed for eligibility (A6).
- Ratios, rounding and the `existingDebt` reading are assumptions A1, A10 to A12.

## 4. Failure states in a real browser (follow-up, 2026-10-21)

Closes the gap this review first recorded. `e2e/api-failures.spec.ts` runs at 1280, 360 and 320 px.

**Method.** Playwright's `page.route` and `context.route` never see requests the service worker answers: with a route fulfilling every `/api` request with a 500, the app still worked normally. So failures are injected by a test-only init script that wraps `window.fetch` before the app loads and passes everything else through to the real fetch, hence to the real service worker mock (behaviours: network failure, an HTTP status, hold until released, and "late", which ignores abort the way a slow server's answer does). The app, client and worker are unchanged, and there are no public failure controls (D-064).

| Scenario                                                | Verified in the browser                                                                                                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules and products fail (offline, then 500), then retry | alert visible and focused, form absent, axe clean (including colour contrast); Try again repeats both requests and shows the form; a 503 is worded differently from offline                                                             |
| Eligibility fails, then retry                           | alert visible and focused; the inputs are exactly as entered; Calculate is enabled; axe clean; retry succeeds and sends the identical request; a failed recalculation keeps the previous 48-month estimate whole and marked out of date |
| Schedule fails alone, then its own retry                | eligibility result stays; alert with Retry schedule; axe clean; the retry sends only the schedule request (eligibility 1 request, schedule 2, same body) and the table then shows all rows                                              |
| Pending                                                 | aria-disabled "Calculating…", axe clean; repeated clicks and Enter send one request                                                                                                                                                     |
| Reset while pending                                     | a late answer (released after Reset) does not restore the result, the status stays "Form reset", fields stay empty, and no schedule is requested                                                                                        |
| Inputs changed while pending                            | request A (48 months) answers after B (24 months); the page shows only the 24-month snapshot, 24 schedule rows, and the requests were exactly eligibility 48 then 24, schedule 24                                                       |
| Late schedule for an earlier snapshot                   | ignored; the table is the later snapshot's                                                                                                                                                                                              |

**Defect found and fixed (D-067).** After an edit, Calculate stayed blocked while any request was pending, so an edited form could not be resubmitted until a slow first request finished, although Enter could. It now blocks only while the same inputs are in flight. A component test covers it.

**Test timing.** Under heavy parallel load (8 Firefox workers) the service worker took up to about 20 s to start, once failing an assertion with the default 5 s timeout; the page was simply still starting (blank until then, then "Loading the loan details…"). `playwright.config.ts` now waits up to 20 s for assertions. This is an observation, not a fix: the app shows nothing until the worker is ready, and has no startup timeout. A startup indicator and timeout would be an improvement, not done here to keep scope.

## 5. WebKit native-select message

Recorded exactly, with the evidence and the mutation check, in [WEBKIT_SELECT_CSP.md](WEBKIT_SELECT_CSP.md). It is WebKit 27.2's own styling of native selects (reproduced on a bare page with one select and no script); the selects work by pointer and keyboard; the allowance is exact (message, event, count, no style in the DOM) and a mutation that adds an inline style attribute makes the test fail. No application defect; the CSP was not changed.

## 6. Not verified, and why

- **A real screen reader**, real browser zoom at 200% and 400%, a real Windows high-contrast theme, Safari and a physical phone were not checked.
- **Firefox and WebKit** run the working flows and the selects; the failure-state suite runs in Chromium only (three widths).
- **Service workers blocked** was checked in Chromium (the error page), not in the other engines.
- The failure injection replaces `fetch` in the page, so it does not exercise failures _inside_ the worker itself (for example the worker script failing to update).

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

## 4. Not verified, and why

- **A real screen reader**, real browser zoom at 200% and 400%, a real Windows high-contrast theme, Safari and a physical phone were not checked (as before).
- **Service-worker behaviour in browsers that block it** was checked only in Chromium with workers blocked (the error page). Firefox and WebKit run the working flows.
- **Failure states in a real browser** (a failed load, calculation or schedule) were not exercised, because that would need failure injection in the shipped mock; they are covered at component level with real HTTP interception and axe in jsdom.
- **Colour contrast of those failure states** is not evaluated (no layout in jsdom); they reuse components and colours whose contrast is checked in the browser.
- WebKit logs a Content Security Policy console message for each native `<select>`; the smoke test tolerates exactly that (D-065).

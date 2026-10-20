# Requirements traceability

How each part of the employer's API specification maps to this repository. The specification is stored verbatim in [LoanEligibilitySimulatorEndpoints.md](LoanEligibilitySimulatorEndpoints.md) and is authoritative, together with the recruitment brief, for field names, nesting and the rules it states. Where it is silent or inconsistent, this page records the **assumption** made (numbered A1–A19, used throughout the docs and code comments). Assumptions are narrow, deterministic choices for a fictional mock; they are **not** employer rules and **not** any lender's policy.

Status values: **Satisfied** (as specified), **Satisfied with assumption** (specified shape, unspecified behaviour filled in), **Differs** (deliberately not as the example shows, with the reason).

## 1. `POST /api/loans/eligibility`

| Item                                       | Specification                                        | Status                    | Where                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Path and method                            | `POST /api/loans/eligibility`                        | Satisfied                 | `API_PATHS` in `src/api/contract.ts`; handler in `src/mock-api/handlers.ts`                                     |
| Request nesting                            | `personalInfo`, `financialInfo`, `loanDetails`       | Satisfied                 | `EligibilityRequest`; built only by `checkForm` in `model/validate.ts`; asserted by the request-shape tests     |
| `personalInfo.age`                         | number, 18–65, required                              | Satisfied                 | Form field "Age"; rule read from `GET …/validation-rules`                                                       |
| `personalInfo.employmentStatus`            | `employed`, `self_employed`, `unemployed`, `retired` | Satisfied                 | Native select; options come from the rules response                                                             |
| `personalInfo.employmentDuration`          | months, required, minimum 3                          | Satisfied with assumption | A4: required for every status, no silent exemptions                                                             |
| `financialInfo.monthlyIncome`              | decimal rand, minimum 5 000, required                | Satisfied                 | Form field "Monthly take-home income"                                                                           |
| `financialInfo.monthlyExpenses`            | decimal rand, minimum 0, required                    | Satisfied                 | Form field "Monthly living expenses" (with the optional expense helper)                                         |
| `financialInfo.existingDebt`               | decimal rand (no rule given)                         | Satisfied with assumption | A1, A2: existing monthly debt repayments, required, ≥ 0                                                         |
| `financialInfo.creditScore`                | 300–850, **optional**                                | Satisfied with assumption | A5: omitted from the request when blank, never sent as 0 or null                                                |
| `loanDetails.requestedAmount`              | decimal rand, 5 000–300 000, required                | Satisfied                 | Form field "Loan amount" + slider                                                                               |
| `loanDetails.loanTerm`                     | months, 6–60, required                               | Satisfied                 | Form field "Repayment term" + slider                                                                            |
| `loanDetails.loanPurpose`                  | a purpose of the product                             | Satisfied with assumption | A6: the purposes of the personal loan; the request has no `loanType`                                            |
| **No `loanType` in the request**           | none in the specification                            | Satisfied                 | Asserted in unit, component and browser tests                                                                   |
| `eligibilityResult.isEligible`             | boolean                                              | Satisfied                 | Outcome title and icon (never colour alone)                                                                     |
| `eligibilityResult.approvalLikelihood`     | number 0–100                                         | Satisfied with assumption | A8; shown as "Illustrative approval likelihood", with a disclaimer                                              |
| `eligibilityResult.riskCategory`           | `low` (others implied)                               | Satisfied with assumption | A7: `low`, `medium`, `high`                                                                                     |
| `eligibilityResult.decisionReason`         | string                                               | Satisfied with assumption | A8; shown verbatim under the outcome                                                                            |
| `recommendedLoan.maxAmount`                | decimal rand                                         | Satisfied with assumption | A8, A15                                                                                                         |
| `recommendedLoan.recommendedAmount`        | decimal rand                                         | Satisfied with assumption | A8, A15                                                                                                         |
| `recommendedLoan.interestRate`             | annual percentage                                    | Satisfied with assumption | A9                                                                                                              |
| `recommendedLoan.monthlyPayment`           | decimal rand                                         | Satisfied                 | A12 gives the rounding; verified independently                                                                  |
| `recommendedLoan.totalRepayment`           | decimal rand                                         | Satisfied                 | Level payment × term, with the final-payment adjustment (A12)                                                   |
| `affordabilityAnalysis.disposableIncome`   | decimal rand                                         | Satisfied with assumption | A11: income − expenses, before existing debt                                                                    |
| `affordabilityAnalysis.debtToIncomeRatio`  | percentage                                           | Satisfied with assumption | A10: existing monthly debt ÷ monthly income                                                                     |
| `affordabilityAnalysis.loanToIncomeRatio`  | percentage                                           | **Differs** (A10, A14)    | Requested ÷ annual income (12 × monthly). The example's 60.0 matches no stated formula, so it is not reproduced |
| `affordabilityAnalysis.affordabilityScore` | `good` (others implied)                              | Satisfied with assumption | A7, A8: `excellent`, `good`, `fair`, `poor`                                                                     |

## 2. `GET /api/loans/products`

| Item                                          | Status                    | Where                                                                                                 |
| --------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Path, method, response nesting (`products[]`) | Satisfied                 | `getProducts` in `src/api/client.ts`; data in `src/mock-api/catalogue.ts`                             |
| Every product field (`id` … `purposes`)       | Satisfied                 | Contract tests compare the response to the specification's own JSON                                   |
| Product information in the UI                 | Satisfied                 | The form's product note and the "About our loan products" disclosure, both built from the response    |
| Vehicle finance                               | Satisfied with assumption | A6: shown for information; the eligibility request cannot name a product, so it is not assessed there |

## 3. `POST /api/loans/calculate-rate`

| Item                                                                | Status                    | Where                                                                                                           |
| ------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Path, method, request fields                                        | Satisfied                 | `CalculateRateRequest`; `loanType` is here (and only here), as specified                                        |
| `creditScore` optional in practice                                  | Satisfied with assumption | A5                                                                                                              |
| `interestRate`, `monthlyPayment`, `totalInterest`, `totalRepayment` | Satisfied                 | Figures verified independently of the code (§ Verification)                                                     |
| `paymentSchedule[]` fields                                          | Satisfied                 | `month`, `payment`, `principal`, `interest`, `balance`                                                          |
| Complete schedule (not two rows)                                    | Satisfied with assumption | A12: the example shows two rows of a longer list; the response has one row per month, and the UI shows them all |
| Both products supported                                             | Satisfied                 | Contract tests cover personal and vehicle; the UI requests the personal loan                                    |
| Unknown `loanType`                                                  | Satisfied with assumption | A13: 400 `UNSUPPORTED_PRODUCT`                                                                                  |

## 4. `GET /api/loans/validation-rules`

| Item                                 | Status     | Where                                                                                                          |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Path, method, nesting                | Satisfied  | `getValidationRules`; data in `catalogue.ts`                                                                   |
| Every rule and `errorMessage`        | Satisfied  | `buildFormRules` in `rules.ts` turns the response into the form's limits; **the form hard-codes none of them** |
| Messages shown to the customer       | Satisfied  | The `errorMessage` strings are shown verbatim beside the field and in the summary                              |
| `creditScore.required: false`        | Satisfied  | A5                                                                                                             |
| Fields with no rule (`existingDebt`) | Assumption | A2                                                                                                             |

## 5. Assumptions

| #   | Topic                     | Assumption                                                                                                                                                                                                                                                      |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `existingDebt`            | Existing **monthly debt repayments** (not a balance). The example's debt-to-income ratio, 5 000 ÷ 25 000 = 20.0%, only works that way. The form label says so.                                                                                                  |
| A2  | `existingDebt` rule       | The rules endpoint has none. The form and mock require it, ≥ 0, and apply the project ceiling (A3). An empty field is an error; 0 is valid.                                                                                                                     |
| A3  | Money ceiling             | Fields with no stated maximum accept at most R100 000 000 (`MAX_MONEY_RAND` in `src/api/assumptions.ts`), shared by form and mock, so absurd input is rejected rather than computed.                                                                            |
| A4  | Employment duration       | Required, whole months, minimum 3, for **every** status. The rules have no conditional exemption, so none is made (an unemployed applicant still enters a duration, then is not assessed, see A8).                                                              |
| A5  | Credit score              | Optional. Blank is sent as an absent field. With no score the rate is the middle of the product's range. A score that is given is validated against 300–850.                                                                                                    |
| A6  | Products and purposes     | The eligibility request has no `loanType`, and its rules are the personal-loan ranges, so the check is for the personal loan; purposes are that product's list. Vehicle finance is listed and priced by calculate-rate but is not assessed for eligibility.     |
| A7  | Enumerations              | Risk: `low`, `medium`, `high`. Affordability: `excellent`, `good`, `fair`, `poor`. The specification shows one value of each.                                                                                                                                   |
| A8  | Decision rules            | Fictional and deterministic, in [SIMULATION_MODEL.md](../SIMULATION_MODEL.md): a new payment may use up to 40% of income − expenses − existing debt; the maximum is the largest R1 000 step that fits; likelihood is a small score; unemployed is not assessed. |
| A9  | Rate pricing              | Within the product's published range, by credit-score band (eighths of the range), no score → middle. A score of 650 gives the personal loan exactly the example's 12.5%.                                                                                       |
| A10 | Ratios                    | Debt-to-income = existing monthly debt ÷ monthly income. Loan-to-income = requested amount ÷ (12 × monthly income). Each has a stated denominator and unit; they are not conflated. Both are percentages rounded half-up to one decimal.                        |
| A11 | Disposable income         | Monthly income − monthly expenses, **before** existing debt repayments.                                                                                                                                                                                         |
| A12 | Rounding                  | Integer cents throughout. The level payment is rounded half-up once. Each month's interest is the opening balance × monthly rate, rounded half-up; principal is payment − interest. The final payment is adjusted so the balance ends at exactly 0.00.          |
| A13 | Error format              | Not specified. Documented in [API.md](../API.md): `{ "error": { "code", "message", "fields?" } }`; 400 `VALIDATION_ERROR`/`UNSUPPORTED_PRODUCT`, 404 `NOT_FOUND`, 500 `INTERNAL_ERROR`.                                                                         |
| A14 | Inconsistent examples     | The specification's numbers do not agree with each other (§ 6). They are not hard-coded anywhere; tests assert the arithmetic instead.                                                                                                                          |
| A15 | Ineligible / none fits    | `maxAmount`, `recommendedAmount`, `monthlyPayment` and `totalRepayment` are 0; the reason says why; the schedule (if shown) is for the requested amount and is labelled as not recommended.                                                                     |
| A16 | Which amount is scheduled | The recommended amount when there is one, otherwise the requested amount, so the schedule always matches the figures beside it. The UI refuses to show a schedule whose rate, payment, total or length disagrees with the estimate.                             |
| A17 | Wire money                | Decimal rand with at most two decimals, as in the examples. The mock converts to integer cents on entry and back on exit.                                                                                                                                       |
| A18 | Mock latency              | 350 ms per request by default (so loading and pending states are visible and testable), 0 in tests. Failures and delays are injected only by tests.                                                                                                             |
| A19 | Unknown `/api` paths      | Answered by the mock itself with the error body (404), so nothing under `/api` ever reaches the host.                                                                                                                                                           |

## 6. Where the specification disagrees with itself

Found by the independent calculation in [docs/validation/phase-6/verify_reference.py](../validation/phase-6/verify_reference.py) (decimal arithmetic, no code shared with the app):

- **Payment.** R150 000 over 24 months at 12.5% a year has a level payment of **R7 096.10**, not the example's R7 089.50. The example's own first row (interest 1 562.33) does not match 150 000 × 12.5% ÷ 12 = 1 562.50, and 7 089.50 × 24 = 170 148.00 is not reproduced by any single rate. The mock returns R7 096.10, total interest R20 306.30, total R170 306.30; the first row is R5 533.60 / R1 562.50 / R144 466.40 and the last R7 096.00 / R7 022.85 / R73.15 / R0.00.
- **Loan-to-income.** 150 000 ÷ (12 × 25 000) is 50.0%; the example says 60.0, which equals 150 000 ÷ (10 × 25 000). No formula is given, so A10 applies and is shown on screen.
- **The sample inputs cannot afford the sample loan.** Income 25 000 − expenses 15 000 − debt 5 000 leaves 5 000 a month; R7 096.10 a month is more than that. With the mock's rule (A8) the same inputs are recommended R42 000, not R150 000, and the example's "85% / low / good" does not appear. The shapes match; the narrative values are not reproduced.

## 7. Verification

| Check                                                           | Result and where                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Contract: all four endpoints over real (intercepted) HTTP       | `src/api/client.test.ts`, 42 tests, shape-checked against the specification's own JSON blocks                          |
| Independent financial values                                    | `verify_reference.py`; the same figures are asserted in `pricing.test.ts`, `eligibility.test.ts` and the browser tests |
| Zero interest, first/last row, principal sum, final balance 0   | `pricing.test.ts`                                                                                                      |
| Minimum / maximum amounts and terms, optional score, boundaries | `client.test.ts`, `validate.test.ts`, `eligibility.test.ts`                                                            |
| Invalid requests, unsupported product, unknown path             | `client.test.ts`                                                                                                       |
| UI calls the API through the client                             | `LoanSimulator.test.tsx`; `e2e/estimate.spec.ts`, `e2e/privacy.spec.ts` (requests answered by the worker)              |
| Loading, failure + retry, pending, duplicate, stale, reset      | `formState.test.ts`, `LoanSimulator.test.tsx`                                                                          |
| Accessibility of every state                                    | `e2e/a11y.spec.ts` (browser axe), `accessibility.test.tsx` (failure states, jsdom axe)                                 |

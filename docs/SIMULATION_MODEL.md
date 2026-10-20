# Simulation model

> **Status:** rewritten in Phase 6. This page describes the **mock API's** pricing and decision rules (`src/mock-api/pricing.ts`, `eligibility.ts`) and how the form prepares and shows their results (`src/features/loan-simulator/model/`). The model of Phases 2–5 (a fixed 19.5% rate, a R69 monthly fee, a "within/above/none" label computed in the browser) was **an assumption made before the employer's API specification was noticed**; it is superseded, not extended (DECISIONS D-054, D-056).
>
> **Scope:** everything here is fictional and deterministic. It is not the employer's rules (the specification defines request and response shapes, not decision logic) and not any lender's policy. The app performs no credit check and makes no approval, decline or offer; the words "estimate", "illustrative" and "demo" are used on purpose.

**In one paragraph.** The browser sends the applicant's details to `POST /api/loans/eligibility`. The mock works out what is left each month after expenses and existing debt repayments, lets a new payment use up to 40% of it, finds the largest R1 000 step of loan that fits, prices it from the credit score within the product's published range, and returns eligibility, an illustrative likelihood and risk, the recommended amount and the affordability analysis. The browser then asks `POST /api/loans/calculate-rate` for the full repayment schedule of the same loan. The UI shows what the API returned and does **no lending maths**.

Assumption numbers (A1…A19) are defined in [requirements/TRACEABILITY.md](requirements/TRACEABILITY.md).

## 1. Units and definitions

| Quantity                       | Definition                                                                          | Unit            | Assumption |
| ------------------------------ | ----------------------------------------------------------------------------------- | --------------- | ---------- |
| Monthly income                 | Take-home pay each month                                                            | rand per month  |            |
| Monthly expenses               | Living costs, **excluding** debt repayments                                         | rand per month  |            |
| Existing debt (`existingDebt`) | Repayments on current loans, cards and accounts each month                          | rand per month  | A1         |
| Disposable income              | income − expenses (before debt)                                                     | rand per month  | A11        |
| Available                      | income − expenses − existing debt                                                   | rand per month  | A8         |
| Debt-to-income ratio           | existing debt ÷ income                                                              | % (one decimal) | A10        |
| Loan-to-income ratio           | requested amount ÷ (12 × income)                                                    | % (one decimal) | A10        |
| Interest rate                  | nominal annual rate, charged monthly on the outstanding balance, fixed for the term | % per year      | A9         |

The two ratios have different denominators (monthly vs annual income) and are never compared with each other.

## 2. Pricing (A9)

Each product publishes a rate range. The credit score places the applicant in eighths of that range (0 = lowest rate):

| Credit score | 750+ | 700–749 | 650–699 | 600–649 | 550–599 | below 550 | none given |
| ------------ | ---- | ------- | ------- | ------- | ------- | --------- | ---------- |
| Eighths      | 0    | 1       | 2       | 4       | 6       | 8         | 4          |

rate (basis points) = min + (max − min) × eighths ÷ 8, rounded half-up to a basis point. For the personal loan (10.5%–18.5%): 10.5, 11.5, **12.5**, 14.5, 16.5, 18.5, and 14.5 with no score. A score of 650 giving exactly 12.5% matches the specification's example rate. The vehicle product (8.5%–15%) uses the same bands (for example 10.13% at 650).

## 3. Payments and schedule (A12)

- All money is **integer cents**; rates are integer basis points.
- Monthly rate r = annual rate ÷ 12. Level payment = round_half_up(P × r ÷ (1 − (1 + r)^−n)); the one floating-point step is the annuity factor. At a rate of zero it is P ÷ n, rounded up to the cent.
- Each month: interest = round_half_up(opening balance × r); principal = payment − interest; balance = opening balance − principal.
- The **final payment is adjusted** so the balance ends at exactly 0.00: it pays the remaining balance plus that month's interest (so it can differ from the level payment by a few cents).
- `totalRepayment` is the sum of the payments; `totalInterest` is `totalRepayment − principal`.
- The response lists **every** month.

## 4. Eligibility (A8, A15)

1. `available = income − expenses − existing debt`.
2. A payment **fits** when `5 × payment ≤ 2 × available` (40%, an exact integer test) and `available > 0`.
3. `maxAmount` is the largest multiple of R1 000, between the product's minimum and maximum amount, whose payment (at the requested term and this applicant's rate) fits. If none fits, it is 0.
4. **Employment:** an unemployed applicant is not assessed (`isEligible: false`, the reason says so). Every other status is assessed the same way; there is no exemption from the employment duration requirement (A4).
5. `isEligible` = not unemployed, `available > 0`, and `maxAmount > 0`.
6. `recommendedAmount` = min(requested, maxAmount) when eligible, otherwise 0; `monthlyPayment` and `totalRepayment` are for that amount (0 when none).
7. `decisionReason` is one of five sentences: unemployed; no money left; even the smallest loan does not fit; the requested amount fits; a smaller amount would fit (naming it).

### Illustrative approval likelihood and risk

likelihood = 50 + credit points + affordability points + employment points, clamped to 5–95, and capped at 15 when not eligible.

| Credit score | 750+ | 700+ | 650+ | 600+ | 550+ | lower | none |
| ------------ | ---- | ---- | ---- | ---- | ---- | ----- | ---- |
| Points       | +25  | +20  | +15  | +5   | −5   | −15   | 0    |

| Affordability score of the **requested** amount | excellent | good | fair | poor |
| ----------------------------------------------- | --------- | ---- | ---- | ---- |
| Points                                          | +20       | +15  | +10  | −20  |

Employment points: unemployed −30; employed or self-employed for 12 months or more +5; otherwise 0. Risk: **low** at 75 or more, **medium** at 50–74, **high** below 50.

### Affordability score (A7)

The requested amount's payment as a share of `available`: **excellent** up to 20%, **good** up to 30%, **fair** up to 40% (the limit), **poor** above 40% or when nothing is available.

## 5. What the browser adds

The browser validates input before sending (the rules come from `GET /api/loans/validation-rules`), builds the request with the contract's exact names and nesting, asks for the schedule of the **recommended** amount (or the requested amount when none is recommended, labelled as not recommended), and refuses to display a schedule whose rate, payment, total or length disagrees with the estimate. It formats money for display only (`R1 986.91`, whole rand elsewhere, `−R398` with U+2212, NBSP grouping). Parsing accepts `28 500`, `R28,500` and `28 500,50`, and never turns empty or malformed text into zero.

## 6. Independently verified reference values

`docs/validation/phase-6/verify_reference.py` recomputes these with Python's `decimal` at high precision, sharing no code with the app (run it with `python -I`). The same values are asserted in `pricing.test.ts`, `eligibility.test.ts`, `client.test.ts` and the browser tests.

| Case                                                   | Rate   | Level payment | Total interest | Total repayment | First row (payment / principal / interest / balance) | Last row                              |
| ------------------------------------------------------ | ------ | ------------- | -------------- | --------------- | ---------------------------------------------------- | ------------------------------------- |
| A. R150 000, 24 months, score 650 (the spec's example) | 12.5%  | 7 096.10      | 20 306.30      | 170 306.30      | 7 096.10 / 5 533.60 / 1 562.50 / 144 466.40          | 7 096.00 / 7 022.85 / 73.15 / 0.00    |
| B. Personal minimum, R5 000, 6 months                  | 18.5%  | 878.87        | 273.22         | 5 273.22        | 878.87 / 801.79 / 77.08 / 4 198.21                   | 878.87 / 865.53 / 13.34 / 0.00        |
| C. Personal maximum, R300 000, 60 months               | 10.5%  | 6 448.17      | 86 890.21      | 386 890.21      | 6 448.17 / 3 823.17 / 2 625.00 / 296 176.83          | 6 448.18 / 6 392.25 / 55.93 / 0.00    |
| D. Vehicle minimum, R50 000, 12 months                 | 10.13% | 4 398.82      | 2 785.81       | 52 785.81       | 4 398.82 / 3 976.74 / 422.08 / 46 023.26             | 4 398.79 / 4 361.97 / 36.82 / 0.00    |
| E. Vehicle maximum, R1 500 000, 72 months              | 8.5%   | 26 667.58     | 420 065.44     | 1 920 065.44    | 26 667.58 / 16 042.58 / 10 625.00 / 1 483 957.42     | 26 667.26 / 26 479.70 / 187.56 / 0.00 |
| F. Zero interest, R1 000, 3 months                     | 0%     | 333.34        | 0.00           | 1 000.00        | 333.34 / 333.34 / 0.00 / 666.66                      | 333.32 / 333.32 / 0.00 / 0.00         |

Eligibility scenarios (income, expenses, debt, amount, term, score, status, months employed):

| #   | Inputs                                                    | Result                                                                                                                          |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| S1  | 25 000, 15 000, 5 000, 150 000, 24, 650, employed, 24     | eligible; max and recommended R42 000; 12.5%; payment 1 986.91; total 47 685.77; 50%, medium; DTI 20; LTI 50; poor              |
| S2  | 40 000, 15 000, 3 000, 100 000, 36, 720, employed, 36     | eligible; max R266 000; recommended R100 000; 11.5%; payment 3 297.60; total 118 713.62; 95%, low; DTI 7.5; LTI 20.8; excellent |
| S3  | 30 000, 12 000, 3 000, 80 000, 48, none, self-employed, 6 | eligible; max R217 000; recommended R80 000; 14.5%; payment 2 206.24; 70%, medium                                               |
| S4  | as S3 with a score of 700, unemployed                     | not eligible; max and recommended 0; 15%, high                                                                                  |
| S5  | 12 000, 9 000, 3 000, 20 000, 24, 650, employed, 24       | not eligible: nothing left after commitments; disposable 3 000; DTI 25; poor                                                    |
| S6  | 5 000, 4 500, 0, 20 000, 6, 650, employed, 24             | not eligible: even R5 000 does not fit; disposable 500                                                                          |
| S7  | 18 000, 8 000, 2 000, 30 000, 36, 540, retired, 12        | eligible; recommended R30 000; 18.5%; payment 1 092.11; 55%, medium                                                             |

## 7. Boundaries covered by tests

A payment that fits at exactly 40% and one cent over; the R1 000 step search at the product's minimum and maximum; zero and negative available money; the smallest and largest amounts and terms of each product; rounding at exactly half a cent; the final-payment adjustment; principal totals equal to the loan; the balance ending at zero; the optional credit score at every band edge (549/550, 599/600, 649/650, 699/700, 749/750); an unsupported `loanType`; and invalid requests (missing, wrong type, out of range, more than two decimals).

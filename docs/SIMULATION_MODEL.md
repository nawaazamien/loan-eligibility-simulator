# Simulation model

> **Status:** implemented in Phase 2, in `src/features/loan-simulator/model/` (`constants.ts`, `amount.ts`, `validate.ts`, `calculate.ts`, `format.ts`, `copy.ts`). Every case in §6 and §7 is a unit test.
>
> **Scope:** this demonstration uses fictional assumptions and does not represent any lender's eligibility criteria or an offer of credit. It is a local, illustrative simulator: it performs no credit-bureau check and makes no approval, decline or offer.

**In one paragraph.** Take-home income minus living expenses and existing debt gives the money available each month. The loan is a standard amortising loan at a fictional 19.5% a year, compounded monthly; its instalment is rounded once, half-up, to the cent, and a fictional R69 monthly fee is added to give the repayment. The estimate is "within" the demo limit when the repayment is at most 40% of the money available, "above" when it is more, and "no room" when nothing is available. All money is integer cents, and the 40% test is the exact integer comparison `5 × repayment ≤ 2 × available`, so no boundary depends on floating-point error.

The model follows the approved design (`design/reference/HANDOFF.md` §7 and the logic in `LoanSimulator.dc.html`). It changes one thing: arithmetic and rounding are made exact (see §4 and DECISIONS D-008).

## 1. Inputs

| Input                            | Meaning                                                                           | Bounds (inclusive)        | Required         |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------- | ---------------- |
| Monthly take-home income         | Net pay received each month, after tax and deductions                             | R1 000 – R1 000 000       | yes              |
| Monthly living expenses          | Rent, groceries, transport, school fees and similar. **Excludes** debt repayments | R0 – R1 000 000           | yes (0 allowed)  |
| Existing monthly debt repayments | Current loans, credit cards, store accounts. **Excludes** the simulated loan      | R0 – R1 000 000           | yes (0 allowed)  |
| Loan amount (principal)          | Amount the customer would like to borrow                                          | R1 000 – R250 000         | yes              |
| Repayment term                   | Number of monthly repayments                                                      | one of 12, 24, 36, 48, 60 | yes (default 36) |

Amounts may include up to two decimal places. Defaults: income, expenses and debt are empty; the loan is 50 000; the term is 36.

### Parsing (from text input)

Following the design: trim, strip a leading `R`/`r`, and remove spaces and NBSPs. Then remove commas that are followed by exactly three digits (thousands grouping) and treat a remaining single comma as the decimal point. The result must match `^-?\d+(\.\d{1,2})?$`.

Each input parses to one of `empty`, `malformed`, `negative`, or `ok(cents)`. The cents value is built from the integer and fraction **strings**, never from `parseFloat`, so `"0.29"` is exactly 29 cents.

Validation order and messages are taken verbatim from the handoff: empty → malformed → negative → range.

## 2. Fictional assumptions (single source: `constants.ts`)

| Assumption                                                              | Value                                                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Annual interest rate                                                    | 19.5% nominal, fixed for the whole term, compounded monthly (r = 0.195 / 12)                                          |
| Monthly service fee                                                     | R69, added to **every** repayment                                                                                     |
| Initiation fee                                                          | none (explicitly excluded)                                                                                            |
| Affordability rule                                                      | The new repayment (including the fee) may use up to **40%** of the money left after living expenses and existing debt |
| Credit insurance, rate changes, credit history, employment, bureau data | not considered                                                                                                        |

## 3. Calculation

All money values are **integer cents**.

```
available   = income − expenses − debt                         (exact)
instalment  = roundHalfUp( P · r / (1 − (1 + r)^−n) )          (cents; P = principal in cents)
            = roundHalfUp( P / n )             when r = 0      (defined zero-interest case)
repayment   = instalment + 6 900                               (fee R69 included)
outcome     = "none"    if available ≤ 0
              "within"  if 5 · repayment ≤ 2 · available        (≡ repayment ≤ 40% of available, exact)
              "above"   otherwise
limit       = floor(2 · available / 5)   when available > 0, else 0   (display and suggestions only)
remaining   = available − repayment                            (may be negative)
total       = repayment · n                                    (includes fees; see D-009)
```

The zero-interest branch is not reachable with the fictional 19.5% rate. It exists so the amortisation function is total and well defined, and it is unit-tested directly.

### Validation

Amounts are checked in the design's order: empty → malformed (including more than two decimal places) → negative → outside the bounds in §1. Values are never clamped, rounded or defaulted. Empty is not zero: `0` is a valid expense or debt amount, an empty field is an error. A number too large to hold exactly is reported as out of range. The term is one of the five radio values; any other value is a programming error and throws. Income that does not cover commitments is a valid **outcome** ("no room"), not an input error.

### Derived suggestions (outcome "above" only)

- **maxLoan**: the largest multiple of R1 000 in [R1 000, R250 000] whose repayment at the **same term** is "within" under the exact rule above. It is found by evaluating the same repayment function, not by inverting the formula, so a suggestion can never contradict the outcome rule. It is shown only when at least R1 000 qualifies. For the reference cases it agrees with the design's closed-form `floor((limit − 69) / factor / 1000) × 1000`.
- **repay60**: the repayment for the same loan over 60 months, with its own within/above status. It is shown only when the term is under 60.

## 4. Rounding and number handling

1. Inputs → exact integer cents (string-based parse).
2. The single floating-point step is the amortisation factor. Its result is rounded **once**, half-up, to whole cents. That rounded instalment is the contractual monthly figure; everything else derives from it in integer arithmetic.
3. The affordability comparison is an exact integer inequality (`5·repayment ≤ 2·available`). A floating-point 40% product never decides a boundary.
4. Display-only rounding:
   - Repayments are shown with cents (`R1 878.88`).
   - Other rand figures are shown as whole rands, rounded half-up from cents (`R4 460`, `R90 186`). The sign is handled separately, so −R398.12 is shown as `−R398`.
   - The percentage is `round(repayment / available × 100)`, half-up, display only, computed in integers.
   - Exception: when an estimate is above the limit by less than R1, the gap is shown with cents (`R0.01`), because whole rand would read "R0 a month above it" (case 6; DECISIONS D-028).
5. Formatting: `R` + digits grouped in threes with NBSP (U+00A0) + `.` decimals; negatives use U+2212 MINUS SIGN (`−R398`). Implemented manually and unit-tested, not with `Intl` en-ZA (which uses comma decimals).

## 5. Outcome wording (from the design, estimate language only)

| Outcome | Title                               | Sub-text                                                                |
| ------- | ----------------------------------- | ----------------------------------------------------------------------- |
| within  | Within the demo affordability limit | An illustration based on fictional assumptions — not a credit decision. |
| above   | Above the demo affordability limit  | (same)                                                                  |
| none    | No room for an additional repayment | (same)                                                                  |
| stale   | (previous title, neutral colour)    | Previous estimate — recalculate to update.                              |

The explanation sentences, next-step tips and the live-region announcement use the handoff templates verbatim. None of the wording says "approved", "qualify", "offer" or "eligible for", except the footnote "Changes don't guarantee you'd qualify for a real loan.", which is itself a disclaimer.

## 6. Reference cases (independently checkable)

**Verification (Phase 2):** all eight cases and the case 2 derived values were re-derived independently with 50-digit decimal arithmetic (Python `decimal`, not the TypeScript implementation) before the implementation was written. Every value below matched; no correction was needed. The same table is the `reference cases` suite in `model/calculate.test.ts`.

Monthly rate r = 0.195 / 12 = 0.01625. The factors below can be checked with any spreadsheet's `PMT(0.195/12, n, -P)`.

| #   | Income    | Expenses | Debt  | Loan    | Term | Available    | Instalment | **Repayment** | Limit (40%) | **Outcome**                                               | Remaining  | Total repayable |
| --- | --------- | -------- | ----- | ------- | ---- | ------------ | ---------- | ------------- | ----------- | --------------------------------------------------------- | ---------- | --------------- |
| 1   | 28 500    | 14 200   | 3 150 | 60 000  | 48   | 11 150.00    | 1 809.88   | **1 878.88**  | 4 460.00    | **within** (17%)                                          | 9 271.12   | 90 186.24       |
| 2   | 18 000    | 11 500   | 2 400 | 120 000 | 36   | 4 100.00     | 4 429.12   | **4 498.12**  | 1 640.00    | **above** (110%)                                          | −398.12    | 161 932.32      |
| 3   | 12 000    | 9 800    | 2 600 | 20 000  | 24   | −400.00      | 1 013.04   | **1 082.04**  | 0           | **none** ("are R400 more than")                           | −1 482.04  | 25 968.96       |
| 4   | 12 000    | 9 000    | 3 000 | 20 000  | 24   | 0.00         | 1 013.04   | **1 082.04**  | 0           | **none** ("use all of")                                   | −1 082.04  | 25 968.96       |
| 5   | 2 705.10  | 0        | 0     | 20 000  | 24   | 2 705.10     | 1 013.04   | **1 082.04**  | 1 082.04    | **within**: boundary, 5 × 108 204 = 2 × 270 510 = 541 020 | 1 623.06   | 25 968.96       |
| 6   | 2 705.09  | 0        | 0     | 20 000  | 24   | 2 705.09     | 1 013.04   | **1 082.04**  | 1 082.03    | **above**: 541 020 > 541 018                              | 1 623.05   | 25 968.96       |
| 7   | 1 000     | 0        | 0     | 1 000   | 12   | 1 000.00     | 92.40      | **161.40**    | 400.00      | **within** (minimum loan and income)                      | 838.60     | 1 936.80        |
| 8   | 1 000 000 | 0        | 0     | 250 000 | 60   | 1 000 000.00 | 6 554.11   | **6 623.11**  | 400 000.00  | **within** (maximum loan)                                 | 993 376.89 | 397 386.60      |

Derived values for case 2 (above): **maxLoan = R42 000** over 36 months (repayment R1 619.19 ≤ R1 640; R43 000 gives R1 656.10, which is above the limit). **repay60 = R3 214.97**, still above the limit.

Zero-interest function check (not reachable through the UI): P = R12 000, n = 12, r = 0 → instalment R1 000.00, repayment R1 069.00.

Note: the handoff quotes "R1 878.96" only as a formatting sample, and the design text says "~R1 879". The exact value for case 1 is **R1 878.88** (R1 809.88 + R69).

## 7. Boundary cases (unit-tested)

- `available == 0` → none, and `available < 0` → none, including the "use all of" and "are R… more than" wording.
- `5·repayment == 2·available` → within (case 5), and one cent less income → above (case 6).
- Input bounds: income R999.99 rejected and R1 000 accepted, R1 000 000 accepted and R1 000 000.01 rejected. Same pattern for loan R1 000 / R250 000 and for expenses and debt R0 / R1 000 000.
- Parsing: `"28 500"`, `"28500"`, `"R28,500"`, `"28 500,50"`, `" 0 "` accepted; `"12,5,00"`, `"1.234"`, `"abc"`, `"1e5"` malformed; `"-5 000"` negative; `""` empty.
- Half-up rounding at exactly .5 of a cent in the instalment (via the pure rounding helper).
- Negative remaining formatted with U+2212, and NBSP grouping on numbers of 4 or more digits.
- maxLoan never contradicts the outcome rule (property check across terms and availability levels).

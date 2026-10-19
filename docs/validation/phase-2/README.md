# Phase 2 visual evidence

Captured on 2026-10-19 with Playwright's Chromium (full-page screenshots, viewport height 900 px, fonts loaded). The live reference, `design/reference/LoanSimulator.dc.html`, rendered through its own preview runtime, and the Phase 2 production build were driven through the same steps: fill the fields, choose the term, select **Calculate estimate**.

| State                         | Inputs (income / expenses / debt / loan / term) | Files                                                                                         |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Within the limit (case 1)     | 28 500 / 14 200 / 3 150 / 60 000 / 48           | `impl-within-1280.png`                                                                        |
| Above the limit (case 2)      | 18 000 / 11 500 / 2 400 / 120 000 / 36          | `ref-above-1280.png`, `impl-above-1280.png`, `ref-above-360.png`, `impl-above-360.png`        |
| No room (case 3)              | 12 000 / 9 800 / 2 600 / 20 000 / 24            | `impl-none-1280.png`, `impl-none-360.png`                                                     |
| Out of date                   | case 1, then income 24 000 and 60 months        | `ref-stale-1280.png`, `impl-stale-1280.png`, `impl-stale-360.png` (phone note under the form) |
| Invalid fields                | −5 000 / 12,5,00 / 2 400 / 400 000              | `ref-invalid-1280.png`, `impl-invalid-1280.png`, `impl-invalid-320.png`                       |
| Largest figures, narrow phone | 1 000 000 / 0 / 0 / 250 000 / 12                | `impl-long-320.png`                                                                           |
| Assumptions expanded          | case 2, then the disclosure opened              | `impl-expanded-320.png`                                                                       |

Every implementation capture had zero horizontal overflow and no console errors. The reference's 360 px renders are 6 px wider than the viewport, from its preview runtime (see Phase 1).

## Intentional differences from the reference

- A focus ring shows on "Your estimate" after calculating and on the error summary after a failed submit (D-030).
- A gap under R1 above the limit is shown in cents (D-028).
- The Recalculate button is 44 px tall instead of 40 px (D-031).
- Mobile corner marks stay on the estimate panel (D-024, from Phase 1).

Notes: [DESIGN_HANDOFF.md §15](../../DESIGN_HANDOFF.md#15-phase-2-inspection-notes).

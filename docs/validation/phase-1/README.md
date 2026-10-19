# Phase 1 visual evidence

Captured on 2026-10-19 with Playwright's Chromium (full-page screenshots, viewport height 900 px, fonts loaded).

- `ref-*` files: the approved reference, `design/reference/LoanSimulator.dc.html`, rendered through its own Claude Design preview runtime (`support.js`, kept local and not committed). That runtime loads React from unpkg.
- `impl-*` files: the Phase 1 production build (`vite preview`).
- `*-example` files: after selecting **Use example values** and expanding **How this estimate is calculated**.
- `focus-*` files: keyboard focus reached with Tab, in the implementation.

| File                                             | Width | State                                                    |
| ------------------------------------------------ | ----- | -------------------------------------------------------- |
| `ref-1280.png` / `impl-1280.png`                 | 1280  | initial (board 1a)                                       |
| `ref-360.png` / `impl-360.png`                   | 360   | initial (board 1j)                                       |
| `ref-1280-example.png` / `impl-1280-example.png` | 1280  | example values, assumptions expanded (close to board 1i) |
| `ref-360-example.png` / `impl-360-example.png`   | 360   | example values, assumptions expanded                     |
| `impl-320.png`                                   | 320   | initial: narrow phone, no horizontal overflow            |
| `impl-760.png`                                   | 760   | initial: first width with the two-column layout          |
| `focus-term-checked.png`                         | 1280  | focus on the selected term (text-colour ring, D-022)     |
| `focus-disclosure.png`                           | 1280  | focus on the assumptions toggle                          |

## Intentional differences from the reference

- **Calculate estimate** is disabled, with a visible note, until Phase 2 (D-018).
- The example message reads "Example values added." until Phase 2 (D-020).
- On mobile, the estimate panel's corner marks stay on the panel. In the reference they escape to the page edges, a preview artefact (D-024). The reference's 360 px render is also 6 px wider than the viewport, from the same runtime.
- The selected term's focus ring uses the text colour (D-022).

The full notes are in [DESIGN_HANDOFF.md §14](../../DESIGN_HANDOFF.md#14-phase-1-inspection-notes).

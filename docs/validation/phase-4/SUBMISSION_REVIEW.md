# Phase 4 submission review

**Verdict: ready for submission with documented manual verification gaps.** Every automated and scripted check below passed after the fixes in §5. Some manual checks have **not** been performed: a real screen reader, real browser zoom, real Windows high contrast, and Safari or a physical phone. They are listed in §7. This is not a claim that all manual checks passed.

## 1. What was tested

| Item          | Value                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code          | the Phase 4 commit (parent `51c164a`); CI results for the pushed commits are in §6                                                                                 |
| Local machine | Windows 11 Pro, Node 24.18.0, npm 11.16.0; Playwright 1.64.1 with Chromium (Chrome for Testing 156), Firefox 157.0, WebKit 27.2                                    |
| CI            | GitHub Actions `ubuntu-latest`: checks job on Node 22 and 24; browser and Docker jobs on Node 24                                                                   |
| Docker        | **Not available locally** (the Docker Desktop engine did not respond within 20s). Verified in CI on a clean checkout with the README's exact commands (§3): passed |

## 2. Fresh clone, following the README

A new directory on D:, cloned from GitHub at `51c164a`, following the README as a reviewer would. The clone contained no `support.js`, `.env` or other local-only files.

| Step                                                              | Result                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                          | Passed, 0 vulnerabilities                                                                                                                                                                                                                                       |
| `npm run check`                                                   | Passed, 164/164 tests                                                                                                                                                                                                                                           |
| `npm test`                                                        | Runs once and exits (it is `vitest run`). The README now says so, and names `npm run test:watch` for watch mode                                                                                                                                                 |
| `npm run test:coverage`                                           | Passed, thresholds met                                                                                                                                                                                                                                          |
| `npx playwright install chromium` (the old README's prerequisite) | **Not enough**: Firefox and WebKit tests failed with "Executable doesn't exist". Fixed: the README now installs all three, with `--with-deps` on Linux                                                                                                          |
| `npm run test:e2e`                                                | Passed: 89 passed, 4 skipped (the pre-Phase-4 suite)                                                                                                                                                                                                            |
| `npm run build`, then `npm run preview`                           | Built. The old README said the preview was at `http://127.0.0.1:4173`, but Vite listens on `localhost`, which resolved to IPv6 here, so that URL refused connections. Fixed: the README now says `http://localhost:4173` (verified 200 for the page and its JS) |
| Node versions                                                     | The old README claimed "22.12 or later". The toolchain actually needs `^22.22.2 \|\| ^24.15.0` (jsdom, Vitest). Fixed in `package.json` and the README; CI now checks Node 22 as well as 24                                                                     |

Nothing needs Claude Design access, `support.js`, credentials or private configuration to build, run or test. The design reference files are inert reference copies, excluded from the Docker context and never bundled.

## 3. Docker

CI runs the README's own commands, adding only `-d --name app` to keep the container in the background:

```sh
docker build -t loan-eligibility-simulator .
docker run -d --name app -p 8080:8080 loan-eligibility-simulator
```

CI then checks the following:

- **Image contents:** only `index.html`, `favicon.svg`, `third-party-notices.txt` and hashed `assets/*.{js,css,woff,woff2}`, against an allow-list. No source maps, sources, tests, docs or design files.
- **Process:** the container's configured user and the running process are uid 101.
- **Assets:** the page and every asset it references load; `/third-party-notices.txt` is served.
- **Caching:** `index.html` is `Cache-Control: no-cache`; hashed assets are `public, max-age=31536000, immutable`.
- **Headers:** CSP `default-src 'self'` and more, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- **404s:** unknown paths return 404, and so does the nginx base image's `/50x.html` (see fix 5).
- **Browser suite against the container:** all three engines.

## 4. Production review

**Build output** (`npm run build`; gzip -9 sizes for reference, nginx compresses JS, CSS and SVG at level 6):

| File                                                                                      | Raw      | Gzip               |
| ----------------------------------------------------------------------------------------- | -------- | ------------------ |
| `index.html`                                                                              | 799 B    | 472 B              |
| JavaScript (one file: React, React DOM, the app, 8 icons)                                 | 249.8 KB | 77.8 KB            |
| CSS                                                                                       | 17.9 KB  | 4.3 KB             |
| Fonts actually loaded: 4 × woff2 (Barlow 400/500/600, Barlow Condensed 600, Latin subset) | 89.3 KB  | already compressed |
| Fonts shipped but not loaded by current browsers: 4 × woff fallbacks from `@fontsource`   | 77.9 KB  | —                  |
| `favicon.svg`                                                                             | 165 B    | —                  |
| `third-party-notices.txt`                                                                 | 20.1 KB  | 3.6 KB             |

| Check                                                                                     | Result                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source maps                                                                               | None, and no `sourceMappingURL`                                                                                                                                                                                                     |
| Development code                                                                          | None: no React Refresh, HMR, `jsxDEV` or console logging; React production build                                                                                                                                                    |
| External runtime dependencies                                                             | None. The only URLs in the bundle are XML namespace identifiers and React's error-documentation base URL (strings, never fetched). Fonts and icons are self-hosted                                                                  |
| Network use                                                                               | The bundle's one `fetch` is Vite's module-preload polyfill (same-origin script URLs only). A full scripted walkthrough at 1280 and 360 px made 7 requests, all same-origin GETs with no body. Only the 4 woff2 fonts were requested |
| Storage                                                                                   | No `localStorage`, `sessionStorage`, IndexedDB or cookies anywhere in the source or bundle                                                                                                                                          |
| Console                                                                                   | No errors, warnings or failed requests in the walkthrough                                                                                                                                                                           |
| Dependency audit                                                                          | `npm audit`: 0 vulnerabilities (runtime only and all). `npm outdated` shows only deliberate pins; TypeScript 7 is held back because typescript-eslint supports below 6.1 (D-003). No changes                                        |
| Unnecessary dependencies                                                                  | None found. Runtime dependencies are React, React DOM, Lucide (8 icons, tree-shaken) and two font packages                                                                                                                          |
| Lighthouse 13.5.0 (local `vite preview`, Playwright's Chromium 156, simulated throttling) | Mobile: performance 98, accessibility 100, best practices 100, SEO 91; FCP 1.9s, LCP 2.0s, TBT 50ms, CLS 0. Desktop: 100 / 100 / 100 / 91; FCP 0.5s, LCP 0.5s, TBT 0ms, CLS 0.027                                                   |

Lighthouse notes: the SEO deduction is only `robots.txt`. `vite preview` answers that path with the app's HTML, while the production nginx returns 404 (checked in CI), which Lighthouse accepts. The desktop CLS of 0.027 is the empty-state list moving slightly when Barlow replaces the fallback font, well under the 0.1 "good" threshold. These are local lab figures, not real-world measurements.

## 5. Fixes made in this phase

| #   | Finding                                                                                                                                                                                                                          | Fix                                                                                                         | Regression test                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **On a 360px phone, after a calculation, pressing Calculate right after editing a field did nothing**: leaving the field added an inline error, which moved the button between mouse-down and mouse-up, so the click was dropped | Calculate, Recalculate and Reset keep focus on pointer press (D-041)                                        | `estimate.spec.ts` "first press" (failed at 360px before the fix)   |
| 2   | The repayment figure broke inside the number at large browser text on a phone                                                                                                                                                    | Figure size capped relative to the panel width; unchanged at normal sizes (D-042)                           | `large-text.spec.ts` (2 lines without the fix)                      |
| 3   | The breakdown bar ran about 5px past the panel's content edge (inherited from the design)                                                                                                                                        | Segments shrink to fit their gaps (D-043)                                                                   | `estimate.spec.ts` "breakdown bar" (4.9px overhang without the fix) |
| 4   | Licence notices for the bundled code and fonts were not shipped (minification drops them)                                                                                                                                        | `public/third-party-notices.txt`, served with the app (D-046)                                               | CI checks that it is served                                         |
| 5   | The nginx base image's `50x.html` would have been served                                                                                                                                                                         | App files in their own directory (D-044)                                                                    | CI file allow-list and `/50x.html` → 404                            |
| 6   | README: Chromium-only prerequisite, wrong preview URL, unverified Node range, POSIX-only `E2E_BASE_URL`                                                                                                                          | Corrected and verified from a fresh clone; `engines` narrowed (D-045)                                       | CI checks job on Node 22 and 24                                     |
| 7   | The CI Docker job built with a different tool and tag than the README documents                                                                                                                                                  | CI uses the README's exact commands (D-047)                                                                 | —                                                                   |
| 8   | Requirement attribution credited the employer with project choices                                                                                                                                                               | PROJECT_PLAN and DECISIONS now separate the brief, the design, the project rules and implementation choices | —                                                                   |

Also: a test locator for "Calculate estimate" also matched "Recalculate estimate" once that button appeared. It is now exact, so tests no longer depend on which buttons happen to be visible.

## 6. Final test results

| Check                   | Local (this machine)                                                                                                                    | CI                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run check`         | Passed: 164/164                                                                                                                         | Passed on Node 22.23.3 and 24.21.0: 164/164 each                                                            |
| `npm run test:coverage` | Passed: model and reducer 100% (enforced); app 99.6% statements, 99.4% branches                                                         | Passed (thresholds enforced on both Node versions)                                                          |
| `npm run test:e2e`      | **99 passed, 4 skipped** (intentional, project-specific) across Chromium ×3 widths, Firefox, WebKit, and Firefox at a 32px default font | **99 passed, 4 skipped** against the production preview, and again against the Docker container; no retries |

CI: [run 39426416360](https://github.com/nawaazamien/loan-eligibility-simulator/actions/runs/39426416360) on `dd59a01`. The Docker job built and ran the image with the README's commands. The image holds exactly 13 files (index.html, favicon, notices, one JS, one CSS, 8 font files) and no `50x.html`. Its JS and CSS hashes match the local build. Later commits that only update records are listed in [PROJECT_PLAN.md](../../PROJECT_PLAN.md#phase-4--production-verification-docker-execution-readme-completion-submission-readiness).

## 7. Manual checks still to do (Nawaaz)

In priority order. None is a known defect; they are checks this environment could not perform.

1. **Real browser zoom.** In Chrome or Edge at a window about 1280px wide, zoom to 200% and then 400% (Ctrl +). Calculate, trigger an error and reset; check that nothing is cut off or needs sideways scrolling.
2. **Keyboard only.** Unplug the mouse. Tab through, use the arrow keys on the term and slider, press Enter to calculate, follow an error link, recalculate and reset. Focus should always be visible and land where you expect.
3. **NVDA or Narrator.** Follow the 10-step checklist in [ACCESSIBILITY_REVIEW.md §4](../phase-3/ACCESSIBILITY_REVIEW.md#manual-checklist-for-nawaaz-nvda--firefox-or-chrome-or-narrator--edge).
4. **Windows high contrast.** Settings → Accessibility → Contrast themes. The selected term and focus rings should be clearly visible.
5. **A real phone, or Safari.** Run the main flow on an iPhone (Safari) and an Android phone: the numeric keyboard, the slider, scrolling to the estimate and the out-of-date note.

## 8. Employer requirements

| The brief asks for                                                                                                                | Where it is met                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A responsive UI where a customer enters income, expenses and a loan amount and sees estimated eligibility from mocked assumptions | The app (plus existing debt and a term, from the design). Layouts from 320px up; fictional, documented assumptions                         |
| Production-grade implementation                                                                                                   | Strict TypeScript, a pure tested model, accessibility review, production build checks, CI on every push                                    |
| A runnable Dockerfile that builds and runs the app                                                                                | [Dockerfile](../../../Dockerfile): verified in CI with the README's exact commands, including the full browser suite against the container |
| A README covering build, run and test                                                                                             | [README.md](../../../README.md): verified from a fresh clone                                                                               |
| A public GitHub repository                                                                                                        | https://github.com/nawaazamien/loan-eligibility-simulator (public)                                                                         |

No licence has been chosen, as directed by the owner; the brief does not require one.

## 9. Repository hygiene

- No credentials, tokens, keys or authentication state in any of the commits (whole history scanned).
- No generated output (`node_modules`, `dist`, `coverage`, test reports, logs) and no `support.js` tracked.
- No absolute machine paths in runnable configuration. The phase records in `docs/` mention the local working path as history only.
- The only email addresses in history are commit metadata: the author's git address and the `Co-Authored-By: Claude` trailer. There is no recruiter correspondence or contact details.
- A real lender's name appeared in one sentence of the Phase 0 `SIMULATION_MODEL.md`. It was replaced with neutral wording in Phase 2 and remains only in that earlier commit's history; it is not a secret, and history was not rewritten.
- Reference assets keep their documented provenance (DESIGN_HANDOFF §12). Font and library licences are in `public/third-party-notices.txt`.

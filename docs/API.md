# API and the in-browser mock

The app talks to a loan API only through one typed client. By default that API is a **mock that runs inside the browser**; pointing the app at a real API is a build setting, not a code change.

```
React UI ──► ApiClient (src/api/client.ts) ──► fetch ──► /api/loans/…
                                                           │
                          default: Mock Service Worker answers inside the browser
                          real API: the same requests go to VITE_API_BASE_URL
```

## The contract

Four endpoints, from [the employer's specification](requirements/LoanEligibilitySimulatorEndpoints.md) (stored verbatim; mapped item by item in [TRACEABILITY.md](requirements/TRACEABILITY.md)).

| Method | Path                          | Client method        | Used by the UI for                                |
| ------ | ----------------------------- | -------------------- | ------------------------------------------------- |
| `GET`  | `/api/loans/validation-rules` | `getValidationRules` | every limit and message in the form               |
| `GET`  | `/api/loans/products`         | `getProducts`        | product information, the personal loan's purposes |
| `POST` | `/api/loans/eligibility`      | `checkEligibility`   | the estimate (eligibility, amounts, rate, ratios) |
| `POST` | `/api/loans/calculate-rate`   | `calculateRate`      | the complete repayment schedule                   |

Types live in `src/api/contract.ts`; runtime guards in `src/api/guards.ts` reject a response that does not match them, so a misbehaving server shows an error instead of wrong figures.

### Errors

The specification has no error format, so this project defines one (assumption A13):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some details are missing or invalid.",
    "fields": [{ "path": "personalInfo.age", "message": "Age must be between 18 and 65" }]
  }
}
```

| Status | `code`                | When                                                     |
| ------ | --------------------- | -------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | A field is missing or breaks a rule; `fields` lists each |
| 400    | `UNSUPPORTED_PRODUCT` | `calculate-rate` with an unknown `loanType`              |
| 404    | `NOT_FOUND`           | Any other path under `/api`                              |
| 500    | `INTERNAL_ERROR`      | The mock cannot find its own product                     |

The client turns failures into `ApiError` with a `kind`: `network` (no response), `http` (error status, with the body above), `invalid-response` (success status, wrong shape) or `aborted` (cancelled, never shown). `VALIDATION_ERROR` field paths are mapped back onto the form's fields.

## How the mock works

- `src/mock-api/handlers.ts` defines the four handlers with [MSW](https://mswjs.io) 2.15.0 using relative paths (`/api/…`). The same handlers serve two runtimes:
  - **Browser** (`src/mock-api/browser.ts`): `setupWorker`, a service worker at `/mockServiceWorker.js` with scope `/`.
  - **Tests** (`src/test/server.ts`): `setupServer`, so unit and component tests exercise the real client over real (intercepted) HTTP, with `onUnhandledRequest: 'error'`.
- `src/main.tsx` starts the worker and **waits for it** before rendering, so no request is made before the mock is ready. While it starts, the page shows a status message (`Startup`, `src/app/Startup.tsx`). If the start fails (service workers blocked, private browsing, an unsupported browser) the page explains that, and if it takes longer than 15 s (`STARTUP_TIMEOUT_MS`; normal starts take well under a second, one measured start under heavy load took about 20 s) it says it is taking too long. Both offer **Try again**. `startMockApi` is idempotent, so a retry waits for the attempt already in flight instead of registering a second worker, and a start that finishes after the message appeared opens the app by itself. Every outcome is handled, so none is an unhandled rejection.
- Anything else under `/api` is answered by the mock with the 404 body above, so no `/api` request ever reaches the host.
- Pricing and decisions are in `pricing.ts` and `eligibility.ts`, documented in [SIMULATION_MODEL.md](SIMULATION_MODEL.md). They are narrow, deterministic, fictional assumptions.
- Latency is 350 ms per request (`mockSettings.latencyMs`) so that loading and pending states are real, and 0 in tests. Failure and delay scenarios exist **only** in tests (`server.use(...)` overrides); the shipped mock never fails on purpose.

## The service worker is intentional infrastructure

| Question                           | Answer                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What does it do?                   | Answers the four `/api` requests inside the browser. Requests for the page, scripts, fonts and images pass straight through.                                                                                                                                                                           |
| Scope                              | `/`, the site root, which is where the file is served from. It cannot control other sites.                                                                                                                                                                                                             |
| Does it store anything?            | No. It holds no state, uses no Cache Storage, IndexedDB, web storage or cookies, and makes no network request of its own for user input. Tests assert all of this.                                                                                                                                     |
| Does user input leave the browser? | No. The entered values appear only in the bodies of the two `POST` requests, which the worker answers; nothing else carries them. The privacy test excludes exactly one request, the fetch of the worker script `/mockServiceWorker.js`, because it is the infrastructure itself and carries no input. |
| Caching                            | The worker script is served `Cache-Control: no-cache` (nginx's default rule, an explicit rule in `render.yaml`, and CI checks for both), so an updated worker is picked up on the next visit. Browsers also re-check a worker script at least daily.                                                   |
| Content Security Policy            | Unchanged: `script-src 'self'` covers the worker script, `connect-src 'self'` covers its requests. Nothing was loosened for the mock.                                                                                                                                                                  |
| Version                            | `public/mockServiceWorker.js` is generated by MSW and must not be edited. `src/mock-api/worker.test.ts` fails if it does not match the installed `msw` version; regenerate with `npx msw init public --no-save`.                                                                                       |

## Replacing the mock with a real API

1. Build with the real API's origin: `VITE_API_BASE_URL=https://api.example.com npm run build`. With it set, the mock is not started and its code is not in the bundle (checked: only the unused `mockServiceWorker.js` file remains in `dist`; delete it from `public/` for a real-API deployment).
2. Allow the origin in the Content Security Policy: add it to `connect-src` in `nginx/security-headers.conf` and in `render.yaml` (a test keeps the two identical). The API must also send CORS headers for the site's origin.
3. The real API must implement the four endpoints exactly as in the specification. The error body in this document is a convention of the mock; the client only needs a non-2xx status for failures, and reads `error.fields` when it is present.
4. Nothing in `src/features/` or `src/app/` changes: the UI depends only on the `ApiClient` interface. To use a different transport or add authentication, supply another `ApiClient` to `<App client={…} />`.

The contract tests in `src/api/client.test.ts` can be pointed at a real server by replacing the MSW handlers with `createApiClient({ baseUrl })`, which is how to check a real implementation against the specification.

## Browser support

The mock needs service workers over HTTPS (or `localhost`). That excludes some private-browsing modes, which show the "can't start in this browser" page.

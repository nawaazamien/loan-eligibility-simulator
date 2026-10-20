import { expect, test, type Request } from '@playwright/test';

import { calculateEstimate, FULL, openApp, openSchedule } from './helpers';

/**
 * Privacy and infrastructure checks for the in-browser mock API.
 *
 * The mock is a service worker: it is deliberate infrastructure, not tracking. These tests pin
 * down what it may and may not do: it answers /api requests inside the browser (so the values
 * a customer types never reach the host), it is scoped to this site, and it stores nothing.
 * The worker's own script request (/mockServiceWorker.js) is the only request excluded from
 * the "no user input is transmitted" check, because it is the worker infrastructure itself
 * and carries no user input; its response is checked separately in hosting-config.spec.ts.
 */
const WORKER_SCRIPT = '/mockServiceWorker.js';
const API_PREFIX = '/api/';

// Distinctive values, so a leak anywhere in a URL, header or body is easy to find.
const MARKED = {
  ...FULL,
  age: '41',
  income: '43789',
  expenses: '15432',
  debt: '3217',
  score: '731',
  loan: '98765',
};
const MARKERS = ['43789', '15432', '3217', '98765', '731'];

test.describe('privacy and the mock API worker', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'One run is enough');
  });

  test('the worker is scoped to this site and takes control before any API call', async ({
    page,
  }) => {
    await openApp(page);
    const registration = await page.evaluate(async () => {
      const found = await navigator.serviceWorker.getRegistration();
      return {
        scope: found?.scope,
        script: (found?.active ?? found?.waiting ?? found?.installing)?.scriptURL,
        controlled: navigator.serviceWorker.controller !== null,
        registrations: (await navigator.serviceWorker.getRegistrations()).length,
      };
    });
    const origin = new URL(page.url()).origin;
    expect(registration).toEqual({
      scope: `${origin}/`,
      script: `${origin}${WORKER_SCRIPT}`,
      controlled: true,
      registrations: 1,
    });
  });

  test('every API request is answered inside the browser, and no request carries user input outside /api', async ({
    page,
  }) => {
    const requests: Request[] = [];
    page.on('request', (request) => requests.push(request));
    const answeredByWorker: Record<string, boolean> = {};
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      if (pathname.startsWith(API_PREFIX))
        answeredByWorker[pathname] = response.fromServiceWorker();
    });

    await openApp(page);
    await calculateEstimate(page, MARKED);
    await openSchedule(page);

    const origin = new URL(page.url()).origin;
    const apiRequests = requests.filter((r) => new URL(r.url()).pathname.startsWith(API_PREFIX));
    expect(apiRequests.map((r) => `${r.method()} ${new URL(r.url()).pathname}`).sort()).toEqual([
      'GET /api/loans/products',
      'GET /api/loans/validation-rules',
      'POST /api/loans/calculate-rate',
      'POST /api/loans/eligibility',
    ]);
    // Answered by the worker, so they never left the browser.
    expect(Object.values(answeredByWorker)).toEqual([true, true, true, true]);

    for (const request of requests) {
      const url = new URL(request.url());
      // Same-origin only: nothing goes to a third party.
      expect(url.origin).toBe(origin);
      // Outside /api, nothing carries user input in its URL, headers or body. The worker's
      // own script request is the one infrastructure request excluded by path.
      if (url.pathname.startsWith(API_PREFIX) || url.pathname === WORKER_SCRIPT) continue;
      const carried = [request.url(), request.postData() ?? '', JSON.stringify(request.headers())];
      for (const text of carried) {
        for (const marker of MARKERS) expect(text).not.toContain(marker);
      }
    }
    // The values only ever appear in the bodies of the two POST requests, as the contract says.
    const bodies = apiRequests.filter((r) => r.method() === 'POST').map((r) => r.postData() ?? '');
    expect(bodies.some((body) => body.includes('43789'))).toBe(true);
    expect(apiRequests.filter((r) => r.method() === 'GET').every((r) => !r.postData())).toBe(true);
  });

  test('nothing is stored: no web storage, IndexedDB, caches or cookies', async ({
    page,
    context,
  }) => {
    await openApp(page);
    await calculateEstimate(page, MARKED);

    const stored = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
      cookie: document.cookie,
    }));
    expect(stored).toEqual({ local: 0, session: 0, databases: 0, caches: 0, cookie: '' });
    expect(await context.cookies()).toEqual([]);
  });

  test('the worker never answers a path outside /api with a made-up response', async ({ page }) => {
    await openApp(page);
    // The page itself is served by the host; an unknown /api path is answered by the mock with
    // the documented error body, so it never reaches the host either.
    const unknown = await page.evaluate(async () => {
      const response = await fetch('/api/loans/unknown');
      return { status: response.status, body: (await response.json()) as unknown };
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

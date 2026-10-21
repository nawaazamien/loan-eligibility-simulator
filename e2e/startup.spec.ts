import { expect, test } from '@playwright/test';

import { age, expectNoAxeViolations } from './helpers';

/**
 * Starting the in-browser mock API: the pending message, a failed start, a start that takes
 * longer than the application's timeout, and recovery.
 *
 * Test-only injection: the worker script is an ordinary network request (the worker cannot
 * answer for itself), so `context.route` can delay, fail or release it. Nothing in the app
 * changes. The application's own startup timeout is 15 s (STARTUP_TIMEOUT_MS); the test
 * timeout for the tests that wait it out is set separately and is larger.
 */
const WORKER = '**/mockServiceWorker.js';
const APP_STARTUP_TIMEOUT_MS = 15_000;
const TOO_SLOW = 'The demo is taking too long to start';
const BLOCKED = "This demo can't start in this browser";

/** A gate a test opens when it wants the held worker request to continue. */
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

test.describe('mock API startup', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name === 'narrow-320', 'Page-level states; two widths suffice');
  });

  test('shows an accessible message while starting, then the app', async ({ context, page }) => {
    const { opened, open } = gate();
    await context.route(WORKER, async (route) => {
      await opened;
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Starting the demo…');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Loan eligibility simulator');
    await expect(page.getByRole('form')).toHaveCount(0);
    await expectNoAxeViolations(page);

    open();
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
    await expect(page.getByText('Starting the demo…')).toHaveCount(0);
  });

  test('a failed start is explained, and Try again recovers', async ({ context, page }) => {
    await context.route(WORKER, (route) => route.abort('failed'));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(BLOCKED);
    await expect(page.getByRole('alert')).toContainText("your browser didn't allow it");
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expectNoAxeViolations(page);

    await context.unroute(WORKER);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
    await expect(age(page)).toBeVisible();
    expect(errors).toEqual([]); // no unhandled rejection from the failed attempt
  });

  test('service workers blocked outright keep the explanation and a Try again button', async ({
    browser,
  }) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText("your browser didn't allow it");
    await page.getByRole('button', { name: 'Try again' }).click();
    // Still blocked, so it fails again with the same explanation rather than hanging.
    await expect(page.getByRole('alert')).toContainText("your browser didn't allow it");
    await context.close();
  });

  test('a start slower than the timeout says so, and finishing late opens the app', async ({
    context,
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'Waits out the real timeout; one run');
    // The test's own timeout is separate from, and larger than, the application's.
    test.setTimeout(APP_STARTUP_TIMEOUT_MS * 3);
    const { opened, open } = gate();
    await context.route(WORKER, async (route) => {
      await opened;
      await route.continue();
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Starting the demo…');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOO_SLOW, {
      timeout: APP_STARTUP_TIMEOUT_MS + 10_000,
    });
    await expect(page.getByRole('alert')).toContainText('has not started yet');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expectNoAxeViolations(page);

    // It finishes after the message appeared: the app opens by itself, once.
    open();
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('Try again after a timeout keeps waiting for the same start', async ({ context, page }) => {
    test.skip(test.info().project.name !== 'desktop', 'Waits out the real timeout; one run');
    test.setTimeout(APP_STARTUP_TIMEOUT_MS * 3);
    const { opened, open } = gate();
    let workerRequests = 0;
    await context.route(WORKER, async (route) => {
      workerRequests += 1;
      await opened;
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TOO_SLOW, {
      timeout: APP_STARTUP_TIMEOUT_MS + 10_000,
    });
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('status')).toHaveText('Starting the demo…');
    open();
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
    // One registration attempt in total: the retry did not start a second one.
    expect(workerRequests).toBe(1);
  });
});

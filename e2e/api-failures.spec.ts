import { expect, test, type Page } from '@playwright/test';

import {
  age,
  calculate,
  estimate,
  expectNoAxeViolations,
  field,
  openApp,
  openSchedule,
  term,
} from './helpers';

/**
 * Failure, retry and race behaviour of the real UI and typed API client in a real browser.
 *
 * How failures are injected (test-only): Playwright's `page.route` / `context.route` never see
 * requests that the service worker answers (checked: with a route that fulfils every /api
 * request with a 500, the app still worked normally), so they cannot fail the mock. Instead an
 * init script, installed only by these tests, wraps `window.fetch` before the app loads. The
 * wrapper passes everything through to the real fetch (and so to the real service worker mock)
 * unless the test has queued a behaviour for that endpoint. The app's own code, the client and
 * the worker are unchanged, and the shipped app has no failure controls.
 *
 * Behaviours, consumed in order per "METHOD /path":
 *   'pass'     the request goes to the mock unchanged
 *   'network'  the request fails as if offline
 *   <number>   the service answers with that HTTP status and the documented error body
 *   'hold'     the request waits until released, then goes to the mock; honours abort
 *   'late'     like 'hold', but ignores abort: the answer still arrives after the app has moved
 *              on, which is what a slow server does
 */
type Behaviour = 'pass' | 'network' | number | 'hold' | 'late';
type Plan = Record<string, Behaviour[]>;

const RULES = 'GET /api/loans/validation-rules';
const PRODUCTS = 'GET /api/loans/products';
const ELIGIBILITY = 'POST /api/loans/eligibility';
const RATE = 'POST /api/loans/calculate-rate';

async function controlApi(page: Page, plan: Plan) {
  await page.addInitScript((initial: Plan) => {
    interface Control {
      plan: Plan;
      log: { key: string; body: string }[];
      waiters: Record<string, (() => void)[]>;
    }
    const control: Control = { plan: initial, log: [], waiters: {} };
    (window as unknown as { __apiTest: Control }).__apiTest = control;
    const real = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = input instanceof Request ? input.url : String(input);
      const url = new URL(raw, window.location.href);
      if (!url.pathname.startsWith('/api/')) return real(input, init);
      const key = `${init?.method ?? 'GET'} ${url.pathname}`;
      control.log.push({ key, body: typeof init?.body === 'string' ? init.body : '' });
      const next = control.plan[key]?.shift();
      if (next === 'network') return Promise.reject(new TypeError('Failed to fetch'));
      if (typeof next === 'number') {
        const body = { error: { code: 'INTERNAL_ERROR', message: 'Injected failure' } };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: next,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (next === 'hold' || next === 'late') {
        return new Promise<Response>((resolve, reject) => {
          const signal = init?.signal;
          const abort = () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          };
          if (next === 'hold' && signal) {
            if (signal.aborted) {
              abort();
              return;
            }
            signal.addEventListener('abort', abort, { once: true });
          }
          (control.waiters[key] ??= []).push(() => {
            if (next === 'hold') {
              signal?.removeEventListener('abort', abort);
              resolve(real(input, init));
            } else {
              const rest: RequestInit = { ...init };
              delete rest.signal;
              resolve(real(input, rest));
            }
          });
        });
      }
      return real(input, init);
    };
  }, plan);
}

async function release(page: Page, key: string) {
  await page.evaluate((k: string) => {
    const control = (
      window as unknown as { __apiTest: { waiters: Record<string, (() => void)[]> } }
    ).__apiTest;
    for (const resume of control.waiters[k] ?? []) resume();
    control.waiters[k] = [];
  }, key);
}

async function requests(page: Page, key: string): Promise<string[]> {
  return page.evaluate(
    (k: string) =>
      (window as unknown as { __apiTest: { log: { key: string; body: string }[] } }).__apiTest.log
        .filter((entry) => entry.key === k)
        .map((entry) => entry.body),
    key,
  );
}

const retryLoad = (page: Page) => page.getByRole('button', { name: 'Try again' });
const exampleFields = async (page: Page) => ({
  age: await age(page).inputValue(),
  income: await field(page, 'Monthly take-home income').inputValue(),
  amount: await field(page, 'Loan amount').inputValue(),
  term: await term(page).inputValue(),
});

test.describe('loading the rules and products fails', () => {
  test('shows an accessible error, then recovers on retry', async ({ page }) => {
    await controlApi(page, { [RULES]: ['network'], [PRODUCTS]: [500] });
    await page.goto('/');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText("We couldn't load the loan details");
    await expect(alert).toBeFocused();
    await expect(page.getByRole('form')).toHaveCount(0);
    await expect(retryLoad(page)).toBeVisible();
    await expectNoAxeViolations(page);

    await retryLoad(page).click();
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    // Both requests were repeated, nothing else.
    expect(await requests(page, RULES)).toHaveLength(2);
    expect(await requests(page, PRODUCTS)).toHaveLength(2);
  });

  test('a server error is explained differently from being offline', async ({ page }) => {
    await controlApi(page, { [PRODUCTS]: [503] });
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('had a problem');
    await retryLoad(page).click();
    await expect(page.getByRole('form', { name: 'Your details' })).toBeVisible();
  });
});

test.describe('the eligibility request fails', () => {
  test('shows a visible, accessible failure, keeps the inputs, and retry recovers', async ({
    page,
  }) => {
    await controlApi(page, { [ELIGIBILITY]: ['network'] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    const before = await exampleFields(page);
    await calculate(page).click();

    const failure = page.getByRole('alert');
    await expect(failure).toContainText("We couldn't calculate your estimate.");
    await expect(failure).toContainText('Check your connection');
    await expect(failure).toBeFocused();
    await expect(estimate(page).getByText('Estimated monthly payment')).toHaveCount(0);
    expect(await exampleFields(page)).toEqual(before);
    await expect(calculate(page)).toBeEnabled();
    await expectNoAxeViolations(page);

    await failure.getByRole('button', { name: 'Try again' }).click();
    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your estimate' })).toBeFocused();
    // The retry sent exactly the same request as the failed attempt.
    const bodies = await requests(page, ELIGIBILITY);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });

  test('a failed recalculation keeps the previous estimate, marked out of date', async ({
    page,
  }) => {
    await controlApi(page, { [ELIGIBILITY]: ['pass', 503] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();
    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    await expect(estimate(page).getByText('Loading the repayment schedule…')).toHaveCount(0);
    const paymentBefore = await estimate(page)
      .locator('p', { hasText: /^R\d/ })
      .first()
      .innerText();

    await term(page).fill('36');
    await calculate(page).click();
    await expect(page.getByRole('alert')).toContainText("We couldn't calculate your estimate.");
    await expect(page.getByRole('alert')).toContainText('had a problem');
    // The old estimate is still shown, flagged as out of date, and its 48-month figures stay whole.
    await expect(estimate(page)).toContainText('Your inputs have changed.');
    await expect(estimate(page)).toContainText('48 months');
    expect(await estimate(page).locator('p', { hasText: /^R\d/ }).first().innerText()).toBe(
      paymentBefore,
    );
    await expectNoAxeViolations(page);
  });
});

test.describe('the schedule request fails', () => {
  test('keeps the eligibility result, and its own retry fetches only the schedule', async ({
    page,
  }) => {
    await controlApi(page, { [RATE]: [500] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();

    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    const retry = estimate(page).getByRole('button', { name: 'Retry schedule' });
    await expect(retry).toBeVisible();
    await expect(estimate(page).getByRole('alert')).toContainText('had a problem');
    await expect(estimate(page).getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Repayment schedule/ })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await retry.click();
    const table = await openSchedule(page);
    await expect(table.locator('tbody tr')).toHaveCount(48);
    await expect(estimate(page).getByRole('button', { name: 'Retry schedule' })).toHaveCount(0);
    expect(await requests(page, ELIGIBILITY)).toHaveLength(1);
    expect(await requests(page, RATE)).toHaveLength(2);
    const [first, second] = await requests(page, RATE);
    expect(second).toBe(first);
  });
});

test.describe('while a request is pending', () => {
  test('the button is aria-disabled and repeated presses send nothing more', async ({ page }) => {
    await controlApi(page, { [ELIGIBILITY]: ['hold'] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();

    const pending = page.getByRole('button', { name: 'Calculating…' });
    await expect(pending).toHaveAttribute('aria-disabled', 'true');
    await expect(estimate(page).getByText('Calculating your estimate…')).toBeVisible();
    await pending.click({ force: true });
    await pending.click({ force: true });
    await age(page).press('Enter');
    expect(await requests(page, ELIGIBILITY)).toHaveLength(1);
    await expectNoAxeViolations(page);

    await release(page, ELIGIBILITY);
    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    expect(await requests(page, ELIGIBILITY)).toHaveLength(1);
  });

  test('Reset abandons the request: a late answer cannot bring the result back', async ({
    page,
  }) => {
    await controlApi(page, { [ELIGIBILITY]: ['late'] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click();
    await expect(estimate(page).getByText('Calculating your estimate…')).toBeVisible();

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(age(page)).toHaveValue('');
    await expect(age(page)).toBeFocused();
    await expect(estimate(page).getByText('Calculating your estimate…')).toHaveCount(0);

    await release(page, ELIGIBILITY); // the answer arrives after the reset
    await page.waitForTimeout(1000); // longer than the mock's latency
    await expect(estimate(page).getByText('Estimated monthly payment')).toHaveCount(0);
    await expect(estimate(page)).toContainText('Enter your details and select Calculate estimate');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(age(page)).toHaveValue('');
    await expect(page.getByRole('form').getByRole('status')).toHaveText(
      'Form reset. Enter your details to calculate a new estimate.',
    );
    // And nothing asked for a schedule on the strength of the late answer.
    expect(await requests(page, RATE)).toHaveLength(0);
  });

  test('changed inputs: the late answer to the old inputs is never combined with the new', async ({
    page,
  }) => {
    await controlApi(page, { [ELIGIBILITY]: ['late'] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click(); // request A: 48 months, held
    await expect(estimate(page).getByText('Calculating your estimate…')).toBeVisible();

    await term(page).fill('24');
    await calculate(page).click(); // request B: 24 months, answered at once
    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    await expect(estimate(page).getByText('Loading the repayment schedule…')).toHaveCount(0);

    await release(page, ELIGIBILITY); // A answers late
    await page.waitForTimeout(1000);

    const summary = estimate(page);
    await expect(summary).toContainText('24 months');
    await expect(summary).not.toContainText('48 months');
    await expect(summary).not.toContainText('Your inputs have changed.');
    const table = await openSchedule(page);
    await expect(table.locator('tbody tr')).toHaveCount(24);
    await expect(table.locator('caption')).toContainText('24 months');
    // Only the snapshot that is shown was ever scheduled.
    const eligibility = (await requests(page, ELIGIBILITY)).map(
      (body) => (JSON.parse(body) as { loanDetails: { loanTerm: number } }).loanDetails.loanTerm,
    );
    expect(eligibility).toEqual([48, 24]);
    const schedules = (await requests(page, RATE)).map(
      (body) => (JSON.parse(body) as { loanTerm: number }).loanTerm,
    );
    expect(schedules).toEqual([24]);
  });

  test('a schedule that arrives late for an earlier snapshot is ignored', async ({ page }) => {
    await controlApi(page, { [RATE]: ['late'] });
    await openApp(page);
    await page.getByRole('button', { name: 'Use example values' }).click();
    await calculate(page).click(); // snapshot A: 48 months; its schedule is held
    await expect(estimate(page).getByText('Estimated monthly payment')).toBeVisible();
    await expect(estimate(page).getByText('Loading the repayment schedule…')).toBeVisible();

    await term(page).fill('24');
    await calculate(page).click(); // snapshot B: 24 months
    await expect(estimate(page)).toContainText('24 months');
    await expect(estimate(page).getByText('Loading the repayment schedule…')).toHaveCount(0);

    await release(page, RATE); // A's schedule arrives now
    await page.waitForTimeout(1000);

    const table = await openSchedule(page);
    await expect(table.locator('tbody tr')).toHaveCount(24);
    await expect(table.locator('caption')).toContainText('24 months');
    await expect(estimate(page)).not.toContainText('48 months');
  });
});

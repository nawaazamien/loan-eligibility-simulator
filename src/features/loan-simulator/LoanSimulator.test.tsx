import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach } from 'vitest';

import { createApiClient } from '../../api/client';
import { API_PATHS } from '../../api/contract';
import { server } from '../../test/server';
import { LoanSimulator } from './LoanSimulator';

/**
 * The whole simulator against the mocked HTTP API: the real client sends real (intercepted)
 * requests, so loading, pending, failure and abandoned-request behaviour is exercised end to end.
 */
async function setup() {
  const user = userEvent.setup();
  render(<LoanSimulator client={createApiClient()} />);
  await screen.findByRole('form', { name: 'Your details' });
  return user;
}

type User = Awaited<ReturnType<typeof setup>>;

const calculate = () => screen.getByRole('button', { name: /^(Calculate estimate|Calculating…)$/ });
const age = () => screen.getByRole('textbox', { name: 'Age in years' });
const amount = () => screen.getByRole('textbox', { name: 'Loan amount in rand' });
const term = () => screen.getByRole('textbox', { name: 'Repayment term in months' });
const creditScore = () => screen.getByRole('textbox', { name: 'Credit score (optional)' });
const estimate = () => screen.getByRole('region', { name: 'Your estimate' });
const CHANGED = 'Your inputs have changed.';

/** The schedule sits in a disclosure that starts closed; opens it and returns the table. */
async function openSchedule(user: User) {
  await user.click(await screen.findByRole('button', { name: /Repayment schedule/ }));
  return screen.getByRole('table');
}

async function calculateExample(user: User) {
  await user.click(screen.getByRole('button', { name: 'Use example values' }));
  await user.click(calculate());
  await screen.findByText('Estimated monthly payment');
}

/** A handler for one endpoint that records requests and lets the test decide when to answer. */
function gate(path: string) {
  let release: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  const seen: unknown[] = [];
  const handler = http.post(path, async ({ request }) => {
    seen.push(await request.json());
    await opened;
    return HttpResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'late' } },
      { status: 500 },
    );
  });
  return { handler, release, seen };
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('loading the rules and products', () => {
  it('shows a loading state, then the form built from the API responses', async () => {
    render(<LoanSimulator client={createApiClient()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the loan details');
    expect(await screen.findByRole('form', { name: 'Your details' })).toBeInTheDocument();
    expect(screen.getByText(/This estimate is for the Personal Loan/)).toBeInTheDocument();
  });

  it('offers a retry when the loan details cannot be loaded, then recovers', async () => {
    server.use(http.get(API_PATHS.validationRules, () => HttpResponse.error()));
    const user = userEvent.setup();
    render(<LoanSimulator client={createApiClient()} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load the loan details");
    expect(alert).toHaveFocus();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('form', { name: 'Your details' })).toBeInTheDocument();
  });
});

describe('the form', () => {
  it('asks for the contract’s fields, with the credit score optional', async () => {
    await setup();
    expect(age()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Employment status/ })).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Time in current employment in months' }),
    ).toBeInTheDocument();
    expect(creditScore()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Loan purpose/ })).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Existing monthly debt repayments in rand' }),
    ).toBeInTheDocument();
  });

  it('reports every problem in a summary that takes focus, and sends nothing', async () => {
    let requests = 0;
    server.use(
      http.post(API_PATHS.eligibility, () => {
        requests += 1;
        return HttpResponse.error();
      }),
    );
    const user = await setup();
    await user.click(calculate());
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('heading')).toHaveTextContent(/Check \d+ fields/);
    expect(within(summary).getByText('Age must be between 18 and 65')).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('shows the API’s message beside an invalid field and clears it once fixed', async () => {
    const user = await setup();
    await user.type(age(), '17');
    await user.click(calculate());
    expect(await screen.findAllByText('Age must be between 18 and 65')).toHaveLength(2);
    await user.clear(age());
    await user.type(age(), '30');
    await user.tab();
    expect(screen.queryAllByText('Age must be between 18 and 65')).toHaveLength(0);
  });

  it('keeps the sliders and fields in step', async () => {
    const user = await setup();
    await user.clear(amount());
    await user.type(amount(), '120000');
    expect(screen.getByRole('slider', { name: 'Loan amount slider' })).toHaveValue('120000');
    await user.clear(term());
    await user.type(term(), '24');
    expect(screen.getByRole('slider', { name: 'Repayment term slider' })).toHaveValue('24');
  });
});

describe('a calculation', () => {
  it('sends the contract’s request (no loanType) then shows the estimate and full schedule', async () => {
    const bodies: unknown[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') {
        void request
          .clone()
          .json()
          .then((body: unknown) => bodies.push(body));
      }
    });
    const user = await setup();
    await calculateExample(user);
    expect(screen.getByRole('heading', { name: 'Your estimate' })).toHaveFocus();

    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    const eligibility = bodies[0] as Record<string, Record<string, unknown>>;
    expect(Object.keys(eligibility)).toEqual(['personalInfo', 'financialInfo', 'loanDetails']);
    expect(eligibility.personalInfo).toEqual({
      age: 35,
      employmentStatus: 'employed',
      employmentDuration: 24,
    });
    expect(JSON.stringify(eligibility)).not.toContain('loanType');
    expect(bodies[1]).toMatchObject({ loanType: 'personal_loan', loanTerm: 48, creditScore: 650 });

    expect(estimate()).toHaveTextContent(/Illustrative approval likelihood/);
    expect(estimate()).toHaveTextContent(/fictional/i);
    const table = await openSchedule(user);
    // Header, one row per month of the 48-month term, and the totals row.
    expect(within(table).getAllByRole('row')).toHaveLength(48 + 2);
  });

  it('announces the result once, politely', async () => {
    const user = await setup();
    await calculateExample(user);
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.querySelectorAll('p')).toHaveLength(1);
    expect(live?.textContent).toMatch(/estimate/i);
  });

  it('shows a pending state and ignores repeat presses while the same inputs are in flight', async () => {
    const pending = gate(API_PATHS.eligibility);
    server.use(pending.handler);
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(calculate());
    expect(await screen.findByText('Calculating your estimate…')).toBeInTheDocument();
    expect(calculate()).toHaveAttribute('aria-disabled', 'true');
    await user.click(calculate());
    await user.click(calculate());
    expect(pending.seen).toHaveLength(1);
    pending.release();
  });

  it('marks an estimate out of date when an input changes, and recalculates on request', async () => {
    const user = await setup();
    await calculateExample(user);
    await user.clear(age());
    await user.type(age(), '40');
    expect(await screen.findByText(CHANGED)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recalculate estimate' }));
    await waitFor(() => {
      expect(screen.queryByText(CHANGED)).not.toBeInTheDocument();
    });
  });

  it('treats a changed credit score as a change to the estimate', async () => {
    const user = await setup();
    await calculateExample(user);
    await user.clear(creditScore());
    expect(await screen.findByText(CHANGED)).toBeInTheDocument();
  });

  it('shows a retryable failure and keeps the previous estimate', async () => {
    const user = await setup();
    await calculateExample(user);
    server.use(http.post(API_PATHS.eligibility, () => HttpResponse.json({}, { status: 503 })));
    await user.clear(term());
    await user.type(term(), '36');
    await user.click(calculate());
    expect(await screen.findByText("We couldn't calculate your estimate.")).toBeInTheDocument();
    expect(screen.getByText('Estimated monthly payment')).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByText("We couldn't calculate your estimate.")).not.toBeInTheDocument();
    });
    expect(await openSchedule(user)).toBeInTheDocument();
  });

  it('keeps the eligibility result when only the schedule fails, and retries just the schedule', async () => {
    let eligibilityRequests = 0;
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname === API_PATHS.eligibility) eligibilityRequests += 1;
    });
    server.use(http.post(API_PATHS.calculateRate, () => HttpResponse.json({}, { status: 500 })));
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(calculate());
    expect(await screen.findByText('Estimated monthly payment')).toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: 'Retry schedule' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    server.resetHandlers();
    await user.click(retry);
    expect(await openSchedule(user)).toBeInTheDocument();
    expect(eligibilityRequests).toBe(1);
  });

  it('ignores the answer to a request that a reset has abandoned', async () => {
    const pending = gate(API_PATHS.eligibility);
    server.use(pending.handler);
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(calculate());
    await screen.findByText('Calculating your estimate…');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    pending.release();
    expect(await screen.findByText(/Form reset/)).toBeInTheDocument();
    expect(screen.queryByText('Estimated monthly payment')).not.toBeInTheDocument();
    expect(screen.queryByText('Calculating your estimate…')).not.toBeInTheDocument();
    expect(screen.queryByText("We couldn't calculate your estimate.")).not.toBeInTheDocument();
    expect(age()).toHaveValue('');
  });

  it('maps a rejection from the API onto the fields', async () => {
    server.use(
      http.post(API_PATHS.eligibility, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Some details are missing or invalid.',
              fields: [{ path: 'personalInfo.age', message: 'Age must be between 18 and 65' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(calculate());
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Age must be between 18 and 65');
    await waitFor(() => {
      expect(summary).toHaveFocus();
    });
  });
});

describe('the expense helper', () => {
  it('still sets the monthly expenses and marks the estimate out of date', async () => {
    const user = await setup();
    await calculateExample(user);
    await user.click(screen.getByRole('button', { name: /Help me calculate my expenses/ }));
    const other = screen.getByRole('textbox', { name: /Other living expenses/ });
    await user.clear(other);
    await user.type(other, '9000');
    await user.click(screen.getByRole('button', { name: 'Use this total' }));
    expect(screen.getByRole('textbox', { name: 'Monthly living expenses in rand' })).toHaveValue(
      '9 000',
    );
    expect(await screen.findByText(CHANGED)).toBeInTheDocument();
  });
});

describe('pressing Calculate while a request is pending', () => {
  it('is a duplicate only while the inputs are unchanged; after an edit it supersedes the request', async () => {
    let release: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = 0;
    server.use(
      http.post(
        API_PATHS.eligibility,
        async () => {
          held += 1;
          await opened;
          return HttpResponse.json({}, { status: 500 });
        },
        { once: true },
      ),
    );
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(calculate());
    expect(await screen.findByRole('button', { name: 'Calculating…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.clear(term());
    await user.type(term(), '24');
    const again = screen.getByRole('button', { name: 'Calculate estimate' });
    expect(again).not.toHaveAttribute('aria-disabled');
    await user.click(again);
    expect(await screen.findByText('Estimated monthly payment')).toBeInTheDocument();
    expect(estimate()).toHaveTextContent('24 months');

    release(); // the first answer (a failure) arrives late and is ignored
    await waitFor(() => {
      expect(held).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("We couldn't calculate your estimate.")).not.toBeInTheDocument();
    expect(estimate()).toHaveTextContent('24 months');
  });
});

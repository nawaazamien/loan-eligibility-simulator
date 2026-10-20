import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';

import { createApiClient } from '../../api/client';
import { API_PATHS } from '../../api/contract';
import { server } from '../../test/server';
import { LoanSimulator } from './LoanSimulator';

/**
 * axe-core over the states a browser test cannot reach against the real mock: a failed load,
 * a failed calculation and a failed schedule. Colour contrast needs real layout, which jsdom
 * does not have, so axe reports it as "incomplete" here; contrast is checked on every state
 * that can be reached in a real browser (e2e/a11y.spec.ts). No rule is disabled.
 */
async function violations() {
  const { violations: found } = await axe.run(document.body, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  });
  return found.map((violation) => ({
    rule: violation.id,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
}

const failing = () => HttpResponse.json({}, { status: 500 });

describe('accessibility of failure and loading states (axe)', () => {
  it('while loading', async () => {
    render(<LoanSimulator client={createApiClient()} />);
    expect(await violations()).toEqual([]);
    await screen.findByRole('form');
  });

  it('when the loan details cannot be loaded', async () => {
    server.use(http.get(API_PATHS.products, failing));
    render(<LoanSimulator client={createApiClient()} />);
    await screen.findByRole('alert');
    expect(await violations()).toEqual([]);
  });

  it('when a calculation fails', async () => {
    server.use(http.post(API_PATHS.eligibility, failing));
    const user = userEvent.setup();
    render(<LoanSimulator client={createApiClient()} />);
    await screen.findByRole('form');
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(screen.getByRole('button', { name: 'Calculate estimate' }));
    await screen.findByText("We couldn't calculate your estimate.");
    expect(await violations()).toEqual([]);
  });

  it('when only the repayment schedule fails', async () => {
    server.use(http.post(API_PATHS.calculateRate, failing));
    const user = userEvent.setup();
    render(<LoanSimulator client={createApiClient()} />);
    await screen.findByRole('form');
    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(screen.getByRole('button', { name: 'Calculate estimate' }));
    await screen.findByRole('button', { name: 'Retry schedule' });
    expect(await violations()).toEqual([]);
  });

  it('with the validation summary showing', async () => {
    const user = userEvent.setup();
    render(<LoanSimulator client={createApiClient()} />);
    await screen.findByRole('form');
    await user.click(screen.getByRole('button', { name: 'Calculate estimate' }));
    await screen.findByRole('alert');
    expect(await violations()).toEqual([]);
  });
});

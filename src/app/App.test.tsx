import { render, screen, within } from '@testing-library/react';

import { App } from './App';

describe('App shell', () => {
  it('exposes the page landmarks with a single top-level heading', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Loan eligibility simulator');
  });

  it('labels the form and estimate panels by their visible headings', () => {
    render(<App />);

    const main = screen.getByRole('main');
    expect(within(main).getByRole('region', { name: 'Your details' })).toBeInTheDocument();
    expect(within(main).getByRole('region', { name: 'Your estimate' })).toBeInTheDocument();
  });

  it('states that the product is a fictional demo, not a credit check or offer', () => {
    render(<App />);

    expect(within(screen.getByRole('banner')).getByText('Demo')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(
      "This isn't a credit check, an approval or an offer.",
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      "It isn't affiliated with any bank or lender",
    );
  });

  it('shows no rand figures in the estimate panel before any calculation exists', () => {
    render(<App />);

    const estimate = screen.getByRole('region', { name: 'Your estimate' });
    expect(estimate.textContent).not.toMatch(/R\s?\d/);
  });
});

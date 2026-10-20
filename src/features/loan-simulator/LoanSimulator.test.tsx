import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { MockInstance } from 'vitest';

import { randFigures } from '../../test/figures';
import { LoanSimulator } from './LoanSimulator';

/** "R1_878.88" → "R1 878.88" with the NBSP used in display figures. */
const nb = (text: string) => text.replaceAll('_', ' ');
/** The same text as Testing Library's whitespace-normalising matchers see it (NBSP → space). */
const sp = (text: string) => text.replaceAll('_', ' ');

function setup() {
  const user = userEvent.setup();
  render(<LoanSimulator />);
  const form = screen.getByRole('form', { name: 'Your details' });
  const estimate = screen.getByRole('region', { name: 'Your estimate' });
  return { user, form, estimate };
}

const income = () => screen.getByRole('textbox', { name: 'Monthly take-home income in rand' });
const expenses = () => screen.getByRole('textbox', { name: 'Monthly living expenses in rand' });
const debt = () =>
  screen.getByRole('textbox', { name: 'Existing monthly debt repayments in rand' });
const loan = () => screen.getByRole('textbox', { name: 'Loan amount in rand' });
const slider = () => screen.getByRole('slider', { name: 'Loan amount slider' });
const term = (months: number) => screen.getByRole('radio', { name: `${String(months)} months` });
const calculate = () => screen.getByRole('button', { name: 'Calculate estimate' });
const estimateHeading = () => screen.getByRole('heading', { name: 'Your estimate' });
const liveRegion = () => document.querySelector('[aria-live="polite"]');

interface Entry {
  income?: string;
  expenses?: string;
  debt?: string;
  loan?: string;
  term?: number;
}

async function enter(user: UserEvent, entry: Entry) {
  const fields = [
    [income, entry.income],
    [expenses, entry.expenses],
    [debt, entry.debt],
    [loan, entry.loan],
  ] as const;
  for (const [field, value] of fields) {
    if (value === undefined) continue;
    await user.clear(field());
    if (value) await user.type(field(), value);
  }
  if (entry.term) await user.click(term(entry.term));
}

const CASE_1: Entry = { income: '28500', expenses: '14200', debt: '3150', loan: '60000', term: 48 };

describe('LoanSimulator form', () => {
  it('labels every amount field and links its helper text', () => {
    setup();

    expect(income()).toHaveAccessibleDescription(
      'The money you receive each month after tax and other deductions.',
    );
    expect(expenses()).toHaveAccessibleDescription(
      "Rent, groceries, transport, school fees and similar costs. Don't include debt repayments.",
    );
    expect(debt()).toHaveAccessibleDescription(
      "Repayments on current loans, credit cards and store accounts. Don't include the loan you're simulating. Enter 0 if you have none.",
    );
    expect(loan()).toHaveAccessibleDescription(nb('Choose an amount between R1_000 and R250_000.'));
    for (const field of [income(), expenses(), debt(), loan()]) {
      expect(field).toHaveAttribute('inputmode', 'decimal');
      expect(field).not.toHaveAttribute('aria-invalid');
    }
  });

  it('groups the fields under their section legends', () => {
    setup();

    const budget = screen.getByRole('group', { name: 'Your monthly budget' });
    expect(within(budget).getAllByRole('textbox')).toHaveLength(3);
    const loanGroup = screen.getByRole('group', { name: "The loan you'd like" });
    const termGroup = within(loanGroup).getByRole('group', { name: 'Repayment term' });
    expect(termGroup).toHaveAccessibleDescription(
      'Longer terms lower the monthly repayment but cost more in interest overall.',
    );
    expect(within(termGroup).getAllByRole('radio')).toHaveLength(5);
  });

  it('starts from the documented defaults with Calculate available', () => {
    setup();

    expect(income()).toHaveValue('');
    expect(expenses()).toHaveValue('');
    expect(debt()).toHaveValue('');
    expect(loan()).toHaveValue('50 000');
    expect(slider()).toHaveValue('50000');
    expect(term(36)).toBeChecked();
    expect(calculate()).toBeEnabled();
    expect(calculate()).toHaveAttribute('type', 'submit');
    expect(calculate()).not.toHaveAccessibleDescription();
  });

  it('keeps typed text as entered and only tidies a valid amount on blur', async () => {
    const { user } = setup();

    await user.type(income(), '28500');
    expect(income()).toHaveValue('28500');
    await user.tab();
    expect(income()).toHaveValue('28 500');
    expect(income()).not.toHaveAttribute('aria-invalid');
  });

  it('keeps the loan field and slider in step', async () => {
    const { user } = setup();

    await enter(user, { loan: '75000' });
    expect(slider()).toHaveValue('75000');
    expect(slider()).toHaveAttribute('aria-valuetext', nb('R75_000'));
    await user.clear(loan());
    expect(slider()).toHaveValue('75000');
    fireEvent.change(slider(), { target: { value: '120000' } });
    expect(loan()).toHaveValue('120 000');
  });

  it('selects a term by click and by arrow keys', async () => {
    const { user } = setup();

    await user.click(term(12));
    await user.keyboard('{ArrowRight}');
    expect(term(24)).toBeChecked();
    expect(term(24)).toHaveFocus();
  });
});

describe('LoanSimulator validation', () => {
  it('shows a linked summary and inline errors, keeps every value and focuses the summary', async () => {
    const { user, estimate } = setup();

    await enter(user, { income: '-5 000', expenses: '12,5,00', loan: '400000' });
    await user.click(calculate());

    const summary = screen.getByRole('alert');
    expect(summary).toHaveAccessibleName('Check 4 fields before calculating');
    expect(summary).toHaveFocus();
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Enter an amount of R0 or more.',
      'Use numbers only, for example 18 500.',
      'Enter your existing debt repayments, or 0 if you have none.',
      nb('Enter an amount between R1_000 and R250_000.'),
    ]);

    expect(income()).toHaveValue('-5 000');
    expect(expenses()).toHaveValue('12,5,00');
    expect(loan()).toHaveValue('400 000');
    expect(income()).toHaveAttribute('aria-invalid', 'true');
    expect(income()).toHaveAccessibleDescription(
      'Enter an amount of R0 or more. The money you receive each month after tax and other deductions.',
    );
    expect(debt()).toHaveAttribute('aria-invalid', 'true');
    expect(randFigures(estimate)).toEqual([]);
  });

  it('moves focus to a field from its summary link', async () => {
    const { user } = setup();

    await user.click(calculate());
    await user.click(
      screen.getByRole('link', {
        name: 'Enter your monthly living expenses, or 0 if you have none.',
      }),
    );
    expect(expenses()).toHaveFocus();
  });

  it('re-validates a field on blur after a submit, not while typing', async () => {
    const { user } = setup();

    await user.click(calculate());
    expect(screen.getByRole('alert')).toHaveAccessibleName('Check 3 fields before calculating');

    await user.type(income(), '500');
    expect(income()).toHaveAccessibleDescription(/^Enter your monthly take-home income\./);
    await user.tab();
    expect(income()).toHaveAccessibleDescription(
      nb(
        'Enter an amount between R1_000 and R1_000_000. The money you receive each month after tax and other deductions.',
      ),
    );

    await user.clear(income());
    await user.type(income(), '18500');
    await user.tab();
    expect(income()).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveAccessibleName('Check 2 fields before calculating');
  });

  it('removes the summary when the last error is fixed', async () => {
    const { user } = setup();

    await enter(user, { income: '20000', expenses: '5000' });
    await user.click(calculate());
    expect(screen.getByRole('alert')).toHaveAccessibleName('Check 1 field before calculating');

    await user.type(debt(), '0');
    await user.tab();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('LoanSimulator results', () => {
  it('calculates on submit, focuses the estimate and announces it', async () => {
    const { user, estimate } = setup();

    await enter(user, CASE_1);
    await user.click(calculate());

    expect(estimateHeading()).toHaveFocus();
    expect(within(estimate).getByText('Within the demo affordability limit')).toBeVisible();
    expect(within(estimate).getByText(sp('R1_878.88'))).toBeVisible();
    expect(estimate).toHaveTextContent(
      sp(
        "would use 17% of the R11_150 you have left each month after expenses and existing debt. That's within the demo limit of 40% (R4_460).",
      ),
    );
    expect(screen.queryByRole('heading', { name: 'What you could try' })).not.toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent(
      sp(
        'Estimate updated. Within the demo affordability limit. Estimated monthly repayment R1_878.88.',
      ),
    );
  });

  it('submits with Enter from a field', async () => {
    const { user, estimate } = setup();

    await enter(user, CASE_1);
    await user.type(debt(), '{Enter}');
    expect(within(estimate).getByText(sp('R1_878.88'))).toBeVisible();
  });

  it('shows every summary figure from the same calculation', async () => {
    const { user, estimate } = setup();

    await enter(user, CASE_1);
    await user.click(calculate());

    const rows = within(estimate)
      .getAllByRole('term')
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ['Loan amount', nb('R60_000')],
      ['Repayment term', '48 months'],
      ['Left after all repayments', nb('R9_271 a month')],
      ['Total repayable', nb('R90_186')],
    ]);
    expect(
      within(estimate).getByRole('heading', { name: nb('Where your R28_500 goes each month') }),
    ).toBeVisible();
  });

  it('shows an estimate above the limit with its shortfall and next steps', async () => {
    const { user, estimate } = setup();

    await enter(user, {
      income: '18000',
      expenses: '11500',
      debt: '2400',
      loan: '120000',
      term: 36,
    });
    await user.click(calculate());

    expect(within(estimate).getByText('Above the demo affordability limit')).toBeVisible();
    expect(estimate).toHaveTextContent(sp('−R398 a month'));
    expect(estimate).toHaveTextContent(
      sp('Your commitments and the new repayment would be R398 more than your income.'),
    );
    const tipsHeading = within(estimate).getByRole('heading', { name: 'What you could try' });
    const tips = tipsHeading.nextElementSibling;
    if (!(tips instanceof HTMLOListElement)) throw new Error('Expected an ordered list of tips');
    expect(within(tips).getAllByRole('listitem')).toHaveLength(3);
    expect(estimate).toHaveTextContent("Changes don't guarantee you'd qualify for a real loan.");
  });

  it('shows when commitments leave no room, without a breakdown', async () => {
    const { user, estimate } = setup();

    await enter(user, { income: '12000', expenses: '9800', debt: '2600', loan: '20000', term: 24 });
    await user.click(calculate());

    expect(within(estimate).getByText('No room for an additional repayment')).toBeVisible();
    expect(estimate).toHaveTextContent(sp('are R400 more than your take-home income'));
    expect(
      within(estimate).queryByRole('heading', { name: /goes each month/ }),
    ).not.toBeInTheDocument();
    expect(within(estimate).getByRole('heading', { name: 'What you could try' })).toBeVisible();
  });
});

describe('LoanSimulator result freshness', () => {
  async function calculated() {
    const view = setup();
    await enter(view.user, CASE_1);
    await view.user.click(calculate());
    return view;
  }

  it('marks the estimate out of date after an edit, keeping it visible', async () => {
    const { user, estimate } = await calculated();

    await user.type(debt(), '0');
    expect(within(estimate).getByRole('status')).toHaveTextContent(
      'Your inputs have changed. The estimate below is out of date.',
    );
    expect(within(estimate).getByText('Previous estimate — recalculate to update.')).toBeVisible();
    expect(within(estimate).getByText(sp('R1_878.88'))).toBeVisible();
    expect(debt()).toHaveFocus();
  });

  it('is current again when the inputs return to the calculated values', async () => {
    const { user, estimate } = await calculated();

    await user.click(term(60));
    expect(within(estimate).getByRole('status')).toHaveTextContent('out of date');
    await user.click(term(48));
    expect(within(estimate).getByRole('status')).toBeEmptyDOMElement();

    // Formatting alone does not change the inputs.
    await user.clear(income());
    await user.type(income(), 'R28,500');
    expect(within(estimate).getByRole('status')).toBeEmptyDOMElement();
  });

  it('keeps the old estimate out of date after an invalid resubmission', async () => {
    const { user, estimate } = await calculated();

    await user.clear(income());
    await user.click(calculate());

    expect(screen.getByRole('alert')).toHaveFocus();
    expect(within(estimate).getByText(sp('R1_878.88'))).toBeVisible();
    expect(within(estimate).getByRole('status')).toHaveTextContent('out of date');
  });

  it('recalculates from the banner and replaces the estimate', async () => {
    const { user, estimate } = await calculated();

    await enter(user, { loan: '120000' });
    await user.click(within(estimate).getByRole('button', { name: 'Recalculate estimate' }));

    expect(within(estimate).getByRole('status')).toBeEmptyDOMElement();
    expect(within(estimate).queryByText(sp('R1_878.88'))).not.toBeInTheDocument();
    expect(within(estimate).getByText('Loan amount').nextElementSibling).toHaveTextContent(
      sp('R120_000'),
    );
    expect(estimateHeading()).toHaveFocus();
  });

  it('announces each successful calculation once, including an identical one', async () => {
    const { user } = await calculated();
    const first = liveRegion()?.firstElementChild;

    await user.click(calculate());
    expect(liveRegion()?.childElementCount).toBe(1);
    expect(liveRegion()?.firstElementChild).not.toBe(first);
    expect(liveRegion()).toHaveTextContent(
      'Estimate updated. Within the demo affordability limit.',
    );
  });

  it('does not announce again after an invalid resubmission', async () => {
    const { user } = await calculated();
    const announced = liveRegion()?.firstElementChild;

    await user.clear(income());
    await user.click(calculate());
    expect(liveRegion()?.firstElementChild).toBe(announced);
  });

  it('fills example values without calculating, and compares them with the last estimate', async () => {
    const { user, form, estimate } = setup();
    await enter(user, { ...CASE_1, income: '40000' });
    await user.click(calculate());

    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    expect(income()).toHaveValue('28 500');
    expect(term(48)).toBeChecked();
    expect(within(form).getByRole('status')).toHaveTextContent(
      'Example values added. Select Calculate estimate to see the result.',
    );
    expect(within(estimate).getByRole('status')).toHaveTextContent('out of date');
  });

  it('reset clears the estimate, errors and announcement, and focuses income', async () => {
    const { user, form, estimate } = await calculated();

    await user.clear(income());
    await user.click(calculate());
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(income()).toHaveValue('');
    expect(income()).toHaveFocus();
    expect(income()).not.toHaveAttribute('aria-invalid');
    expect(loan()).toHaveValue('50 000');
    expect(term(36)).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(estimate).toHaveTextContent('Enter your details and select Calculate estimate to see:');
    expect(randFigures(estimate)).toEqual([]);
    expect(liveRegion()).toBeEmptyDOMElement();
    expect(within(form).getByRole('status')).toHaveTextContent(
      'Form reset. Enter your details to calculate a new estimate.',
    );
  });
});

describe('LoanSimulator estimate panel', () => {
  it('shows the initial state and no figures before a calculation', () => {
    const { estimate } = setup();

    expect(estimate).toHaveTextContent('Enter your details and select Calculate estimate to see:');
    expect(randFigures(estimate)).toEqual([]);
  });

  it('expands and collapses the assumptions', async () => {
    const { user, estimate } = setup();

    const toggle = within(estimate).getByRole('button', {
      name: 'How this estimate is calculated',
    });
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveTextContent(
      'All rates, fees and rules are fictional and used for demonstration only.',
    );

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(panel).not.toBeVisible();
  });
});

describe('LoanSimulator scrolling to the estimate', () => {
  let scrollIntoView: MockInstance<Element['scrollIntoView']>;

  /** Answers media queries as a phone (or not), with or without a reduced-motion preference. */
  function mediaAs({ narrow, reduceMotion }: { narrow: boolean; reduceMotion: boolean }) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('max-width') ? narrow : query.includes('reduce') && reduceMotion,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(() => false),
        }) satisfies MediaQueryList,
    );
  }

  beforeEach(() => {
    scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function calculateCase1() {
    const { user } = setup();
    await enter(user, CASE_1);
    await user.click(calculate());
    expect(estimateHeading()).toHaveFocus();
  }

  it('scrolls the estimate heading into view smoothly on a phone', async () => {
    mediaAs({ narrow: true, reduceMotion: false });
    await calculateCase1();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('jumps without animation when reduced motion is preferred', async () => {
    mediaAs({ narrow: true, reduceMotion: true });
    await calculateCase1();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('does not scroll on wide screens, where the estimate is beside the form', async () => {
    mediaAs({ narrow: false, reduceMotion: false });
    await calculateCase1();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

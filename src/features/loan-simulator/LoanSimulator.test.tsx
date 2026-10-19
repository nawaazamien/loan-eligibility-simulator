import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { randFigures } from '../../test/figures';
import { LoanSimulator } from './LoanSimulator';

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
    expect(loan()).toHaveAccessibleDescription('Choose an amount between R1 000 and R250 000.');

    for (const field of [income(), expenses(), debt(), loan()]) {
      expect(field).toHaveAttribute('inputmode', 'decimal');
    }
  });

  it('groups the fields under their section legends', () => {
    setup();

    const budget = screen.getByRole('group', { name: 'Your monthly budget' });
    expect(within(budget).getAllByRole('textbox')).toHaveLength(3);

    const loanGroup = screen.getByRole('group', { name: "The loan you'd like" });
    expect(within(loanGroup).getByRole('textbox', { name: 'Loan amount in rand' })).toBeVisible();

    const termGroup = within(loanGroup).getByRole('group', { name: 'Repayment term' });
    expect(termGroup).toHaveAccessibleDescription(
      'Longer terms lower the monthly repayment but cost more in interest overall.',
    );
    expect(within(termGroup).getAllByRole('radio')).toHaveLength(5);
  });

  it('starts from the documented defaults', () => {
    setup();

    expect(income()).toHaveValue('');
    expect(expenses()).toHaveValue('');
    expect(debt()).toHaveValue('');
    expect(loan()).toHaveValue('50 000');
    expect(slider()).toHaveValue('50000');
    expect(term(36)).toBeChecked();
  });

  it('keeps typed text as entered and only tidies a valid amount on blur', async () => {
    const { user } = setup();

    await user.type(income(), '28500');
    expect(income()).toHaveValue('28500');

    await user.tab();
    expect(income()).toHaveValue('28 500');
  });

  it('never turns missing or malformed text into zero', async () => {
    const { user } = setup();

    await user.type(expenses(), '12,5,00');
    await user.tab();
    expect(expenses()).toHaveValue('12,5,00');

    await user.type(debt(), '5');
    await user.clear(debt());
    await user.tab();
    expect(debt()).toHaveValue('');
  });

  it('moves the slider when a valid loan amount is typed', async () => {
    const { user } = setup();

    await user.clear(loan());
    await user.type(loan(), '75000');
    expect(slider()).toHaveValue('75000');
    expect(slider()).toHaveAttribute('aria-valuetext', 'R75 000');
  });

  it('keeps the slider in place while the loan text is incomplete', async () => {
    const { user } = setup();

    await user.clear(loan());
    expect(loan()).toHaveValue('');
    expect(slider()).toHaveValue('50000');
  });

  it('writes the slider position into the loan field', () => {
    setup();

    fireEvent.change(slider(), { target: { value: '120000' } });
    expect(loan()).toHaveValue('120 000');
    expect(slider()).toHaveAttribute('aria-valuetext', 'R120 000');
  });

  it('selects a term by click and by arrow keys', async () => {
    const { user } = setup();

    await user.click(term(12));
    expect(term(12)).toBeChecked();
    expect(term(36)).not.toBeChecked();

    await user.keyboard('{ArrowRight}');
    expect(term(24)).toBeChecked();
    expect(term(24)).toHaveFocus();
  });

  it('fills the example values without calculating anything', async () => {
    const { user, estimate } = setup();

    await user.click(screen.getByRole('button', { name: 'Use example values' }));

    expect(income()).toHaveValue('28 500');
    expect(expenses()).toHaveValue('14 200');
    expect(debt()).toHaveValue('3 150');
    expect(loan()).toHaveValue('60 000');
    expect(slider()).toHaveValue('60000');
    expect(term(48)).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Example values added.');
    expect(randFigures(estimate)).toEqual([]);
  });

  it('clears the status message on the next edit', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.type(income(), '0');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('resets to the defaults, says so and moves focus to the first field', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.click(term(12));
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(income()).toHaveValue('');
    expect(expenses()).toHaveValue('');
    expect(debt()).toHaveValue('');
    expect(loan()).toHaveValue('50 000');
    expect(slider()).toHaveValue('50000');
    expect(term(36)).toBeChecked();
    expect(income()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Form reset. Enter your details to calculate a new estimate.',
    );
  });

  it('shows the calculate action as disabled and explains why', () => {
    const { form } = setup();

    const calculate = within(form).getByRole('button', { name: 'Calculate estimate' });
    expect(calculate).toBeDisabled();
    expect(calculate).toHaveAttribute('type', 'submit');
    expect(calculate).toHaveAccessibleDescription(
      "Calculation isn't available in this development version yet.",
    );
  });

  it('does not submit or calculate when Enter is pressed in a field', async () => {
    const { user, estimate } = setup();

    await user.click(screen.getByRole('button', { name: 'Use example values' }));
    await user.type(income(), '{Enter}');

    expect(randFigures(estimate)).toEqual([]);
    expect(income()).toHaveValue('28 500');
  });
});

describe('LoanSimulator estimate panel', () => {
  it('shows the initial state and no figures', () => {
    const { estimate } = setup();

    expect(within(estimate).getByText('Illustrative only')).toBeVisible();
    expect(estimate).toHaveTextContent('Enter your details and select Calculate estimate to see:');
    expect(
      within(estimate)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'your estimated monthly repayment',
      "what you'd have left each month",
      'whether it fits the demo affordability limit',
      'what you could change to improve it',
    ]);
    expect(randFigures(estimate)).toEqual([]);
  });

  it('expands and collapses the assumptions', async () => {
    const { user, estimate } = setup();

    const toggle = within(estimate).getByRole('button', {
      name: 'How this estimate is calculated',
    });
    const panelId = toggle.getAttribute('aria-controls') ?? '';
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent('19.5% a year, fixed for the full term.');
    expect(panel).toHaveTextContent(
      'All rates, fees and rules are fictional and used for demonstration only.',
    );

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
  });
});

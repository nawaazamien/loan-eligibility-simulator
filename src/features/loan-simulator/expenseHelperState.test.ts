import {
  applyHelper,
  blurCategory,
  closeHelper,
  editCategory,
  initialExpenseHelper,
  openHelper,
  syncAppliedWithExpenses,
  type ExpenseHelperState,
} from './expenseHelperState';
import { EMPTY_EXPENSE_DRAFT } from './model/expenses';

/** Opens, fills and applies a breakdown; returns the closed helper and the field text. */
function appliedBreakdown() {
  let helper = openHelper(initialExpenseHelper, '');
  helper = editCategory(helper, 'housing', '6000');
  helper = editCategory(helper, 'food', '4 500.50');
  const outcome = applyHelper(helper);
  if (!outcome.ok) throw new Error('Expected the breakdown to apply');
  return outcome;
}

describe('opening the helper', () => {
  it('keeps an existing manual total by placing it under Other living expenses', () => {
    const helper = openHelper(initialExpenseHelper, '14 200');
    expect(helper.open).toBe(true);
    expect(helper.draft).toEqual({ ...EMPTY_EXPENSE_DRAFT, other: '14 200' });
    expect(helper.note).toEqual({ kind: 'movedToOther', cents: 1_420_000 });
  });

  it('restores the applied breakdown while the field still equals its total', () => {
    const { helper, expensesText } = appliedBreakdown();
    expect(expensesText).toBe('10 500.50');

    const reopened = openHelper(helper, '10500.50');
    expect(reopened.draft).toEqual({
      ...EMPTY_EXPENSE_DRAFT,
      housing: '6 000',
      food: '4 500.50',
    });
    expect(reopened.note).toBeNull();
  });

  it('starts empty, saying it will replace the field, when the field is empty or invalid', () => {
    for (const text of ['', 'abc', '-5']) {
      const helper = openHelper(initialExpenseHelper, text);
      expect(helper.draft).toEqual(EMPTY_EXPENSE_DRAFT);
      expect(helper.note).toEqual({ kind: 'replaces' });
    }
  });
});

describe('editing, cancelling and applying', () => {
  it('cancel discards unapplied edits but keeps the applied breakdown', () => {
    const { helper } = appliedBreakdown();
    const edited = editCategory(openHelper(helper, '10 500.50'), 'housing', '9999');
    const closed = closeHelper(edited);
    expect(closed.open).toBe(false);
    expect(closed.draft).toEqual(EMPTY_EXPENSE_DRAFT);
    expect(closed.applied).toEqual(helper.applied);
    expect(openHelper(closed, '10 500.50').draft.housing).toBe('6 000');
  });

  it('applies the integer-cent total and closes, remembering the breakdown', () => {
    const { helper, expensesText } = appliedBreakdown();
    expect(expensesText).toBe('10 500.50');
    expect(helper.open).toBe(false);
    expect(helper.applied?.cents).toBe(1_050_050);
    expect(helper.applyCount).toBe(1);
  });

  it('applies an all-blank draft as R0', () => {
    const outcome = applyHelper(openHelper(initialExpenseHelper, ''));
    expect(outcome).toMatchObject({ ok: true, expensesText: '0' });
  });

  it('stays open with category errors when an amount is invalid', () => {
    let helper = openHelper(initialExpenseHelper, '');
    helper = editCategory(helper, 'transport', '1,2,3');
    const outcome = applyHelper(helper);
    expect(outcome.ok).toBe(false);
    expect(outcome.helper.open).toBe(true);
    expect(outcome.helper.errors).toEqual({ transport: 'Use numbers only, for example 18 500.' });
    expect(outcome.helper.attempted).toBe(true);
  });

  it('stays open with a total error when the categories add up to too much', () => {
    let helper = openHelper(initialExpenseHelper, '');
    helper = editCategory(helper, 'housing', '70 000 000');
    helper = editCategory(helper, 'other', '40 000 000');
    const outcome = applyHelper(helper);
    expect(outcome.ok).toBe(false);
    expect(outcome.helper.errors).toEqual({});
    expect(outcome.helper.totalError).toContain('R110 000 000');
  });

  it('re-checks a category on blur only after a failed apply', () => {
    let helper: ExpenseHelperState = openHelper(initialExpenseHelper, '');
    helper = blurCategory(editCategory(helper, 'food', 'abc'), 'food');
    expect(helper.errors).toEqual({});

    helper = applyHelper(helper).helper;
    expect(helper.errors.food).toBeDefined();
    helper = blurCategory(editCategory(helper, 'food', '2500'), 'food');
    expect(helper.errors).toEqual({});
    expect(helper.draft.food).toBe('2 500');
  });

  it('after a failed apply, a blur updates only the category that was left', () => {
    let helper: ExpenseHelperState = openHelper(initialExpenseHelper, '');
    helper = editCategory(editCategory(helper, 'food', 'abc'), 'transport', '-5');
    helper = applyHelper(helper).helper;
    expect(Object.keys(helper.errors).sort()).toEqual(['food', 'transport']);
    helper = blurCategory(editCategory(helper, 'food', 'still bad'), 'food');
    expect(Object.keys(helper.errors).sort()).toEqual(['food', 'transport']);
    helper = blurCategory(editCategory(helper, 'transport', '10'), 'transport');
    expect(Object.keys(helper.errors)).toEqual(['food']);
  });
});

describe('keeping the saved breakdown honest', () => {
  it('forgets the breakdown once the expenses field changes to another amount', () => {
    const { helper } = appliedBreakdown();
    expect(syncAppliedWithExpenses(helper, '10500.50').applied).not.toBeNull();
    expect(syncAppliedWithExpenses(helper, '12 000').applied).toBeNull();
    expect(syncAppliedWithExpenses(helper, '').applied).toBeNull();
  });

  it('does not bring old categories back for a new total', () => {
    const { helper } = appliedBreakdown();
    const reopened = openHelper(syncAppliedWithExpenses(helper, '12 000'), '12 000');
    expect(reopened.draft).toEqual({ ...EMPTY_EXPENSE_DRAFT, other: '12 000' });
  });
});

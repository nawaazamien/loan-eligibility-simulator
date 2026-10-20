import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, type Dispatch, type RefObject } from 'react';

import { Button } from '../../components/Button';
import { cx } from '../../styles/cx';
import { CurrencyField } from './CurrencyField';
import styles from './ExpenseHelper.module.css';
import type { ExpenseHelperState } from './expenseHelperState';
import type { FormAction } from './formState';
import { MAX_MONEY_CENTS } from './model/constants';
import { EXPENSE_CATEGORIES, totalDraft } from './model/expenses';
import { formatCents } from './model/format';

interface ExpenseHelperProps {
  helper: ExpenseHelperState;
  dispatch: Dispatch<FormAction>;
  /** The monthly-expenses field, which receives focus after "Use this total". */
  expensesInputRef: RefObject<HTMLInputElement | null>;
}

const money = (cents: number) => formatCents(cents, { withCents: cents % 100 !== 0 });

function totalLine(helper: ExpenseHelperState): string {
  const total = totalDraft(helper.draft);
  if (total.ok) return `Total ${money(total.cents)} a month`;
  if (total.reason === 'tooLarge') {
    return `Total ${money(total.cents)} a month, more than the ${formatCents(MAX_MONEY_CENTS)} limit`;
  }
  return "Some amounts can't be read yet, so there's no total to show. Correct them to see it.";
}

/**
 * "Help me calculate my expenses": an optional, inline breakdown inside the monthly-expenses
 * field. It is part of the loan form (forms cannot be nested), so Enter in a category is
 * handled here and never submits the loan calculation.
 */
export function ExpenseHelper({ helper, dispatch, expensesInputRef }: ExpenseHelperProps) {
  const idBase = useId();
  const panelId = `${idBase}-panel`;
  const totalErrorId = `${idBase}-total-error`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const handledApply = useRef(helper.applyCount);

  const categoryId = (key: string) => `${idBase}-${key}`;

  useEffect(() => {
    // Once per "Use this total": to the expenses field on success, else to the first problem.
    if (helper.applyCount === handledApply.current) return;
    handledApply.current = helper.applyCount;
    if (!helper.open) {
      expensesInputRef.current?.focus();
      return;
    }
    const firstInvalid = EXPENSE_CATEGORIES.find(({ key }) => helper.errors[key]);
    const target = firstInvalid
      ? document.getElementById(categoryId(firstInvalid.key))
      : helper.totalError
        ? document.getElementById(totalErrorId)
        : null;
    target?.focus();
  });

  const apply = () => {
    dispatch({ type: 'applyExpenseHelper' });
  };

  return (
    <div className={styles.helper}>
      <Button
        ref={toggleRef}
        variant="ghost"
        keepFocusOnPress
        aria-expanded={helper.open}
        aria-controls={panelId}
        onClick={() => {
          dispatch({ type: helper.open ? 'closeExpenseHelper' : 'openExpenseHelper' });
        }}
        className={styles.toggle}
      >
        Help me calculate my expenses
        <ChevronDown
          aria-hidden="true"
          size={18}
          strokeWidth={1.5}
          className={cx(styles.chevron, helper.open && styles.open)}
        />
      </Button>

      <div
        id={panelId}
        hidden={!helper.open}
        className={styles.panel}
        onKeyDown={(event) => {
          // Enter in a category applies the helper instead of submitting the loan form.
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            apply();
          }
        }}
      >
        {helper.open && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Monthly living expenses by category</legend>
            <p className={styles.guidance}>
              Include living costs only. Enter loan, credit card and car-finance repayments under
              existing monthly debt repayments. Leave a category blank if it doesn't apply: blank
              counts as R0.
            </p>
            {helper.note?.kind === 'movedToOther' && (
              <p className={styles.note}>
                This started with your current amount, {money(helper.note.cents)}, under Other
                living expenses. Move parts of it into the categories that apply.
              </p>
            )}
            {helper.note?.kind === 'replaces' && (
              <p className={styles.note}>
                Using this total will replace what is in Monthly living expenses.
              </p>
            )}

            <div className={styles.grid}>
              {EXPENSE_CATEGORIES.map(({ key, label }) => (
                <CurrencyField
                  key={key}
                  id={categoryId(key)}
                  name={`expense-${key}`}
                  label={label}
                  value={helper.draft[key]}
                  error={helper.errors[key]}
                  onChange={(text) => {
                    dispatch({ type: 'editExpenseCategory', category: key, text });
                  }}
                  onBlur={() => {
                    dispatch({ type: 'blurExpenseCategory', category: key });
                  }}
                />
              ))}
            </div>

            {/* Plain text, not a live region: the total is not announced on every keystroke. */}
            <p className={styles.total}>{totalLine(helper)}</p>
            {helper.totalError && (
              <p id={totalErrorId} tabIndex={-1} className={styles.totalError}>
                {helper.totalError}
              </p>
            )}

            <p className={styles.guidance}>
              Your monthly expenses change only when you select ‘Use this total’.
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" keepFocusOnPress onClick={apply}>
                Use this total
              </Button>
              <Button
                variant="ghost"
                keepFocusOnPress
                onClick={() => {
                  dispatch({ type: 'closeExpenseHelper' });
                  toggleRef.current?.focus();
                }}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}

import { Info } from 'lucide-react';
import { useId, useRef, type Dispatch } from 'react';

import { Button } from '../../components/Button';
import { FrameCorners } from '../../components/Frame';
import frameStyles from '../../components/Frame.module.css';
import { cx } from '../../styles/cx';
import { CurrencyField } from './CurrencyField';
import type { AmountField, FormAction, FormState, FormStatus } from './formState';
import styles from './LoanForm.module.css';
import { LoanAmountField } from './LoanAmountField';
import { TermSelector } from './TermSelector';

type BudgetField = Exclude<AmountField, 'loan'>;

/** Labels and helper text, verbatim from the design (HANDOFF §5). */
const BUDGET_FIELDS: readonly { field: BudgetField; label: string; hint: string }[] = [
  {
    field: 'income',
    label: 'Monthly take-home income',
    hint: 'The money you receive each month after tax and other deductions.',
  },
  {
    field: 'expenses',
    label: 'Monthly living expenses',
    hint: "Rent, groceries, transport, school fees and similar costs. Don't include debt repayments.",
  },
  {
    field: 'debt',
    label: 'Existing monthly debt repayments',
    hint: "Repayments on current loans, credit cards and store accounts. Don't include the loan you're simulating. Enter 0 if you have none.",
  },
];

/**
 * Phase 1 wording. The design's example message continues "Select Calculate estimate to
 * see the result.", which would point at a disabled button until Phase 2 (DECISIONS D-020).
 */
const STATUS_TEXT: Record<Exclude<FormStatus, null>, string> = {
  example: 'Example values added.',
  reset: 'Form reset. Enter your details to calculate a new estimate.',
};

interface LoanFormProps {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}

export function LoanForm({ state, dispatch }: LoanFormProps) {
  const idBase = useId();
  const headingId = `${idBase}-heading`;
  const calculateNoteId = `${idBase}-calculate-note`;
  const incomeRef = useRef<HTMLInputElement>(null);

  const fieldId = (field: AmountField) => `${idBase}-${field}`;
  const edit = (field: AmountField) => (text: string) => {
    dispatch({ type: 'edit', field, text });
  };
  const blur = (field: AmountField) => () => {
    dispatch({ type: 'blur', field });
  };

  return (
    <form
      noValidate
      aria-labelledby={headingId}
      onSubmit={(event) => {
        // Calculation arrives in Phase 2; the submit button is disabled until then.
        event.preventDefault();
      }}
      className={cx(frameStyles.frame, styles.form)}
    >
      <FrameCorners />
      <div className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          Your details
        </h2>
        <Button
          variant="ghost"
          onClick={() => {
            dispatch({ type: 'useExample' });
          }}
        >
          Use example values
        </Button>
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Your monthly budget</legend>
        {BUDGET_FIELDS.map(({ field, label, hint }) => (
          <CurrencyField
            key={field}
            id={fieldId(field)}
            name={field}
            label={label}
            hint={hint}
            value={state.values[field]}
            onChange={edit(field)}
            onBlur={blur(field)}
            {...(field === 'income' ? { inputRef: incomeRef } : {})}
          />
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>The loan you'd like</legend>
        <LoanAmountField
          id={fieldId('loan')}
          value={state.values.loan}
          sliderValue={state.loanSlider}
          onChange={edit('loan')}
          onBlur={blur('loan')}
          onSlide={(rand) => {
            dispatch({ type: 'slide', rand });
          }}
        />
        <TermSelector
          value={state.term}
          onChange={(term) => {
            dispatch({ type: 'selectTerm', term });
          }}
        />
      </fieldset>

      <div className={styles.actions}>
        <div className={styles.buttons}>
          <Button
            variant="primary"
            type="submit"
            disabled
            aria-describedby={calculateNoteId}
            className={styles.calculate}
          >
            <FrameCorners />
            Calculate estimate
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: 'reset' });
              incomeRef.current?.focus();
            }}
          >
            Reset
          </Button>
        </div>
        <p id={calculateNoteId} className={styles.note}>
          Calculation isn't available in this development version yet.
        </p>
        <div role="status" className={styles.status}>
          {state.status && (
            <>
              <Info aria-hidden="true" size={16} strokeWidth={1.5} className={styles.statusIcon} />
              <span>{STATUS_TEXT[state.status]}</span>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

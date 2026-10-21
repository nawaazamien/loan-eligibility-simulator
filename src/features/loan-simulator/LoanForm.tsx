import { Info } from 'lucide-react';
import { useId, useRef, type Dispatch, type Ref } from 'react';

import { Button } from '../../components/Button';
import { FrameCorners } from '../../components/Frame';
import frameStyles from '../../components/Frame.module.css';
import { cx } from '../../styles/cx';
import { CurrencyField } from './CurrencyField';
import { ErrorSummary } from './ErrorSummary';
import { ExpenseHelper } from './ExpenseHelper';
import type { FormAction, FormState, FormStatus } from './formState';
import styles from './LoanForm.module.css';
import { EMPLOYMENT_LABELS, FIELDS, PURPOSE_LABELS, type Field } from './model/fields';
import { formatCents, formatPercent, formatRand } from './model/format';
import { ProductInfo } from './ProductInfo';
import { fieldsKey } from './model/validate';
import { RangeSlider } from './RangeSlider';
import { amountSliderRange, termSliderRange, type FormRules } from './rules';
import { SelectField } from './SelectField';

/** The example and reset messages are verbatim from the design (HANDOFF §5). */
function statusText(status: Exclude<FormStatus, null>, state: FormState): string {
  switch (status) {
    case 'example':
      return 'Example values added. Select Calculate estimate to see the result.';
    case 'reset':
      return 'Form reset. Enter your details to calculate a new estimate.';
    case 'expensesApplied': {
      const applied = state.expenseHelper.applied;
      const amount = applied
        ? formatCents(applied.cents, { withCents: applied.cents % 100 !== 0 })
        : 'your total';
      return `Monthly living expenses set to ${amount} from your breakdown.`;
    }
  }
}

function between(min: number | undefined, max: number | undefined, unit: string): string {
  if (min !== undefined && max !== undefined) {
    return `${String(min)} to ${String(max)} ${unit}`;
  }
  return min === undefined ? '' : `at least ${String(min)} ${unit}`;
}

interface LoanFormProps {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  rules: FormRules;
  /** Whether the estimate shown no longer matches these inputs. */
  isStale: boolean;
  summaryRef: Ref<HTMLDivElement>;
}

export function LoanForm({ state, dispatch, rules, isStale, summaryRef }: LoanFormProps) {
  const idBase = useId();
  const headingId = `${idBase}-heading`;
  const ageRef = useRef<HTMLInputElement>(null);
  const expensesRef = useRef<HTMLInputElement>(null);
  // Pressing Calculate again is only a duplicate while the same inputs are already in flight;
  // after an edit it supersedes the earlier request, as pressing Enter in a field does.
  const pending = state.pending !== null && state.pending.key === fieldsKey(state.values);

  const fieldId = (field: Field) => `${idBase}-${field}`;
  const edit = (field: Field) => (text: string) => {
    dispatch({ type: 'edit', field, text });
  };
  const blur = (field: Field) => () => {
    dispatch({ type: 'blur', field });
  };

  const summaryErrors = FIELDS.flatMap((field) => {
    const message = state.errors[field];
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });

  const amountRange = amountSliderRange(rules);
  const termRange = termSliderRange(rules);
  const { product } = rules;

  return (
    <form
      noValidate
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: 'submit' });
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

      {state.showSummary && summaryErrors.length > 0 && (
        <ErrorSummary ref={summaryRef} errors={summaryErrors} />
      )}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>About you</legend>
        <CurrencyField
          id={fieldId('age')}
          name="age"
          label="Age"
          hint={`Your age in years, ${between(rules.age.min, rules.age.max, 'years')}.`}
          prefix=""
          unit="in years"
          inputMode="numeric"
          value={state.values.age}
          error={state.errors.age}
          onChange={edit('age')}
          onBlur={blur('age')}
          inputRef={ageRef}
        />
        <SelectField
          id={fieldId('employmentStatus')}
          name="employmentStatus"
          label="Employment status"
          value={state.values.employmentStatus}
          options={rules.employmentStatus.options.map((value) => ({
            value,
            label: EMPLOYMENT_LABELS[value],
          }))}
          placeholder="Select your employment status"
          error={state.errors.employmentStatus}
          onChange={edit('employmentStatus')}
          onBlur={blur('employmentStatus')}
        />
        <CurrencyField
          id={fieldId('employmentDuration')}
          name="employmentDuration"
          label="Time in current employment"
          hint={`How long you have been in your current work or income source, in whole months${rules.employmentDuration.min === undefined ? '' : `. At least ${String(rules.employmentDuration.min)}`}.`}
          prefix=""
          unit="in months"
          inputMode="numeric"
          value={state.values.employmentDuration}
          error={state.errors.employmentDuration}
          onChange={edit('employmentDuration')}
          onBlur={blur('employmentDuration')}
        />
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Your monthly budget</legend>
        <CurrencyField
          id={fieldId('income')}
          name="income"
          label="Monthly take-home income"
          hint={`The money you receive each month after tax and other deductions. At least ${formatCents(rules.income.minCents)}.`}
          value={state.values.income}
          error={state.errors.income}
          onChange={edit('income')}
          onBlur={blur('income')}
        />
        <CurrencyField
          id={fieldId('expenses')}
          name="expenses"
          label="Monthly living expenses"
          hint="Rent, groceries, transport, school fees and similar costs. Don't include debt repayments."
          value={state.values.expenses}
          error={state.errors.expenses}
          onChange={edit('expenses')}
          onBlur={blur('expenses')}
          inputRef={expensesRef}
        >
          <ExpenseHelper
            helper={state.expenseHelper}
            dispatch={dispatch}
            expensesInputRef={expensesRef}
          />
        </CurrencyField>
        <CurrencyField
          id={fieldId('debt')}
          name="debt"
          label="Existing monthly debt repayments"
          hint="Repayments on current loans, credit cards and store accounts. Don't include the loan you're simulating. Enter 0 if you have none."
          value={state.values.debt}
          error={state.errors.debt}
          onChange={edit('debt')}
          onBlur={blur('debt')}
        />
        <CurrencyField
          id={fieldId('creditScore')}
          name="creditScore"
          label="Credit score (optional)"
          hint={`Between ${String(rules.creditScore.min ?? '')} and ${String(rules.creditScore.max ?? '')}. Leave it blank if you don't know it: a middle-of-the-range rate is used.`}
          prefix=""
          unit={null}
          inputMode="numeric"
          value={state.values.creditScore}
          error={state.errors.creditScore}
          onChange={edit('creditScore')}
          onBlur={blur('creditScore')}
        />
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>The loan you'd like</legend>
        <p className={styles.productNote}>
          This estimate is for the {product.name}: {formatRand(product.minAmount)} to{' '}
          {formatRand(product.maxAmount)} over {String(product.minTerm)} to{' '}
          {String(product.maxTerm)} months, at {formatPercent(product.interestRateRange.min)} to{' '}
          {formatPercent(product.interestRateRange.max)} a year depending on credit score.
        </p>
        <SelectField
          id={fieldId('purpose')}
          name="purpose"
          label="Loan purpose"
          value={state.values.purpose}
          options={rules.purposes.map((value) => ({ value, label: PURPOSE_LABELS[value] }))}
          placeholder="Select what the loan is for"
          error={state.errors.purpose}
          onChange={edit('purpose')}
          onBlur={blur('purpose')}
        />
        <CurrencyField
          id={fieldId('amount')}
          name="amount"
          label="Loan amount"
          hint={`Choose an amount between ${formatCents(rules.amount.minCents)} and ${formatCents(amountRange.max * 100)}.`}
          value={state.values.amount}
          error={state.errors.amount}
          onChange={edit('amount')}
          onBlur={blur('amount')}
        >
          <RangeSlider
            label="Loan amount slider"
            min={amountRange.min}
            max={amountRange.max}
            step={amountRange.step}
            value={state.sliders.amount}
            valueText={formatRand(state.sliders.amount)}
            endLabels={[formatRand(amountRange.min), formatRand(amountRange.max)]}
            onChange={(value) => {
              dispatch({ type: 'slide', which: 'amount', value });
            }}
          />
        </CurrencyField>
        <CurrencyField
          id={fieldId('term')}
          name="term"
          label="Repayment term"
          hint={`Between ${String(termRange.min)} and ${String(termRange.max)} months. A longer term lowers the monthly payment but costs more in interest overall.`}
          prefix=""
          unit="in months"
          inputMode="numeric"
          value={state.values.term}
          error={state.errors.term}
          onChange={edit('term')}
          onBlur={blur('term')}
        >
          <RangeSlider
            label="Repayment term slider"
            min={termRange.min}
            max={termRange.max}
            step={termRange.step}
            value={state.sliders.term}
            valueText={`${String(state.sliders.term)} months`}
            endLabels={[`${String(termRange.min)} months`, `${String(termRange.max)} months`]}
            onChange={(value) => {
              dispatch({ type: 'slide', which: 'term', value });
            }}
          />
        </CurrencyField>
      </fieldset>

      <ProductInfo products={rules.products} assessedId={product.id} />

      <div className={styles.actions}>
        <div className={styles.buttons}>
          <Button
            variant="primary"
            type="submit"
            keepFocusOnPress
            // Not `disabled`: it keeps its place in the tab order and focus, and says why.
            aria-disabled={pending || undefined}
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
            className={styles.calculate}
          >
            <FrameCorners />
            {pending ? 'Calculating…' : 'Calculate estimate'}
          </Button>
          <Button
            variant="secondary"
            keepFocusOnPress
            onClick={() => {
              dispatch({ type: 'reset' });
              ageRef.current?.focus();
            }}
          >
            Reset
          </Button>
        </div>
        <div className={styles.messages}>
          <div role="status" className={styles.status}>
            {state.status && (
              <>
                <Info
                  aria-hidden="true"
                  size={16}
                  strokeWidth={1.5}
                  className={styles.statusIcon}
                />
                <span>{statusText(state.status, state)}</span>
              </>
            )}
          </div>
          {/* Phones only: the estimate is below the form, out of sight. Not a live region;
            the estimate panel's own status already announces that it is out of date. */}
          {isStale && !state.status && (
            <p className={styles.staleNote}>
              <Info aria-hidden="true" size={16} strokeWidth={1.5} className={styles.statusIcon} />
              <span>Your inputs have changed. Calculate again to update the estimate below.</span>
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

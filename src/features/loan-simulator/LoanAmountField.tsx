import { CurrencyField } from './CurrencyField';
import styles from './LoanAmountField.module.css';
import { LOAN_MAX_RAND, LOAN_MIN_RAND, LOAN_STEP_RAND } from './model/constants';
import { formatRand } from './model/format';

interface LoanAmountFieldProps {
  id: string;
  value: string;
  error?: string | undefined;
  sliderValue: number;
  onChange: (text: string) => void;
  onBlur: () => void;
  onSlide: (rand: number) => void;
}

/**
 * The loan amount: a precise text field (the source of truth) with a range slider as a
 * quicker alternative. Moving the slider writes its value into the field; typing a valid
 * amount moves the slider. Calculation always reads the text field, never the slider.
 */
export function LoanAmountField({
  id,
  value,
  error,
  sliderValue,
  onChange,
  onBlur,
  onSlide,
}: LoanAmountFieldProps) {
  return (
    <CurrencyField
      id={id}
      name="loan"
      label="Loan amount"
      hint={`Choose an amount between ${formatRand(LOAN_MIN_RAND)} and ${formatRand(LOAN_MAX_RAND)}.`}
      value={value}
      error={error}
      onChange={onChange}
      onBlur={onBlur}
    >
      <div className={styles.slider}>
        <input
          type="range"
          min={LOAN_MIN_RAND}
          max={LOAN_MAX_RAND}
          step={LOAN_STEP_RAND}
          value={sliderValue}
          onChange={(event) => {
            onSlide(Number(event.target.value));
          }}
          aria-label="Loan amount slider"
          aria-valuetext={formatRand(sliderValue)}
          className={styles.range}
        />
        <div aria-hidden="true" className={styles.ends}>
          <span>{formatRand(LOAN_MIN_RAND)}</span>
          <span>{formatRand(LOAN_MAX_RAND)}</span>
        </div>
      </div>
    </CurrencyField>
  );
}

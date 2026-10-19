import { useId } from 'react';

import { TERMS, type Term } from './model/constants';
import styles from './TermSelector.module.css';

interface TermSelectorProps {
  value: Term;
  onChange: (term: Term) => void;
}

/**
 * Native radio buttons in a fieldset, styled as the design's segmented control. Being real
 * radios, they get arrow-key navigation and a single tab stop from the browser.
 */
export function TermSelector({ value, onChange }: TermSelectorProps) {
  const name = useId();
  const hintId = `${name}-hint`;

  return (
    <fieldset className={styles.fieldset} aria-describedby={hintId}>
      <legend className={styles.legend}>Repayment term</legend>
      <p id={hintId} className={styles.hint}>
        Longer terms lower the monthly repayment but cost more in interest overall.
      </p>
      <div className={styles.options}>
        {TERMS.map((term) => (
          <label key={term} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={term}
              checked={term === value}
              onChange={() => {
                onChange(term);
              }}
              className={styles.radio}
            />
            <span className={styles.number}>{term}</span>{' '}
            <span className={styles.unit}>months</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

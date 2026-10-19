import { CircleAlert } from 'lucide-react';
import type { ReactNode, Ref } from 'react';

import { cx } from '../../styles/cx';
import styles from './CurrencyField.module.css';

interface CurrencyFieldProps {
  id: string;
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
  /** Validation message; shown between the hint and the input, as in the design. */
  error?: string | undefined;
  inputRef?: Ref<HTMLInputElement>;
  /** Extra controls that belong to this field, such as the loan slider. */
  children?: ReactNode;
}

/**
 * A rand amount field. The text is kept exactly as typed (formatting happens on blur, in
 * the reducer), so the caret never jumps. `inputMode="decimal"` brings up a numeric
 * keyboard on phones while still allowing spaces and a decimal point.
 */
export function CurrencyField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  onBlur,
  error,
  inputRef,
  children,
}: CurrencyFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label} <span className="visually-hidden">in rand</span>
      </label>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
      {error && (
        <p id={errorId} className={styles.error}>
          <CircleAlert
            aria-hidden="true"
            size={16}
            strokeWidth={1.5}
            className={styles.errorIcon}
          />
          <span>{error}</span>
        </p>
      )}
      <div className={styles.control}>
        <span aria-hidden="true" className={styles.prefix}>
          R
        </span>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onBlur={onBlur}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          aria-invalid={error ? true : undefined}
          className={cx(styles.input, error && styles.invalid)}
        />
      </div>
      {children}
    </div>
  );
}

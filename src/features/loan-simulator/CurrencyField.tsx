import { CircleAlert } from 'lucide-react';
import type { ReactNode, Ref } from 'react';

import { cx } from '../../styles/cx';
import styles from './CurrencyField.module.css';

interface CurrencyFieldProps {
  id: string;
  name: string;
  label: string;
  /** Helper text under the label; optional for compact fields such as expense categories. */
  hint?: string;
  value: string;
  /** Visible prefix before the value; "R" for amounts, none for ages and months. */
  prefix?: string;
  /** Unit read out after the label ("in rand"); null for none. */
  unit?: string | null;
  inputMode?: 'decimal' | 'numeric';
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
  prefix = 'R',
  unit = 'in rand',
  inputMode = 'decimal',
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
        {label}
        {unit ? ' ' : ''}
        {unit && <span className="visually-hidden">{unit}</span>}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
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
        {prefix && (
          <span aria-hidden="true" className={styles.prefix}>
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onBlur={onBlur}
          aria-describedby={
            [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={error ? true : undefined}
          className={cx(styles.input, !prefix && styles.noPrefix, error && styles.invalid)}
        />
      </div>
      {children}
    </div>
  );
}

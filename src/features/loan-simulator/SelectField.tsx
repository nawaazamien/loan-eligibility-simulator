import { CircleAlert } from 'lucide-react';
import type { Ref } from 'react';

import { cx } from '../../styles/cx';
import styles from './CurrencyField.module.css';

interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string | undefined;
  selectRef?: Ref<HTMLSelectElement>;
}

/**
 * A native select with the same label, hint and error pattern as the amount fields. The empty
 * option is a visible prompt, so "nothing chosen yet" stays distinct from every real choice.
 */
export function SelectField({
  id,
  name,
  label,
  hint,
  value,
  options,
  placeholder,
  onChange,
  onBlur,
  error,
  selectRef,
}: SelectFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
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
        <select
          ref={selectRef}
          id={id}
          name={name}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onBlur={onBlur}
          aria-describedby={
            [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={error ? true : undefined}
          className={cx(styles.input, styles.noPrefix, styles.select, error && styles.invalid)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

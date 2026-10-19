import type { ReactNode, Ref } from 'react';

import styles from './CurrencyField.module.css';

interface CurrencyFieldProps {
  id: string;
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
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
  inputRef,
  children,
}: CurrencyFieldProps) {
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label} <span className="visually-hidden">in rand</span>
      </label>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
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
          aria-describedby={hintId}
          className={styles.input}
        />
      </div>
      {children}
    </div>
  );
}

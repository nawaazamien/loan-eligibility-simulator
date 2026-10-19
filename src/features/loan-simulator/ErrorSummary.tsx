import { CircleAlert } from 'lucide-react';
import { useId, type Ref } from 'react';

import styles from './ErrorSummary.module.css';

interface ErrorSummaryProps {
  /** Each problem, in form order, with the id of the field it belongs to. */
  errors: readonly { fieldId: string; message: string }[];
  ref?: Ref<HTMLDivElement>;
}

/**
 * Shown after a failed Calculate. It receives focus (tabIndex -1), and each link moves
 * focus to its field: following a fragment link alone does not focus an input everywhere.
 */
export function ErrorSummary({ errors, ref }: ErrorSummaryProps) {
  const headingId = useId();
  const count = errors.length === 1 ? '1 field' : `${String(errors.length)} fields`;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={headingId}
      className={styles.summary}
    >
      <CircleAlert aria-hidden="true" size={22} strokeWidth={1.5} className={styles.icon} />
      <div className={styles.body}>
        <h3 id={headingId} className={styles.heading}>
          Check {count} before calculating
        </h3>
        <ul className={styles.list}>
          {errors.map(({ fieldId, message }) => (
            <li key={fieldId}>
              <a
                href={`#${fieldId}`}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(fieldId)?.focus();
                }}
                className={styles.link}
              >
                {message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
